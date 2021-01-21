import * as vscode from 'vscode';
import http from 'http';
import express from 'express';
import cors from 'cors';
import RED from 'node-red';
import { LocalSettings as NodeRedSettings } from 'node-red__runtime';
import { AddressInfo } from 'net';
import fsExtra from 'fs-extra';
import path from 'path';

// TODO: The following is a snippet from node_modules/@node-red/editor-client/public/red/red.js, with a working websocket in a VSCode extension WebView.  Notice the path and port are set, and the path ultimately has "/red" appended after the port.
// function connectWS() {
// 	active = true;
// 	var wspath;
// 	if (RED.settings.apiRootUrl) {
// 			var m = /^(https?):\/\/(.*)$/.exec(RED.settings.apiRootUrl);
// 			if (m) {
// 					console.log(m);
// 					wspath = "ws"+(m[1]==="https"?"s":"")+"://"+m[2]+"comms";
// 			}
// 	} else {
// 			var path = '127.0.0.1';
// 			var port = 65000;
// 			if (port.length !== 0) {
// 					path = path+":"+port;
// 			}
// 			path = path+'/red';
// 			path = path+(path.slice(-1) == "/"?"":"/")+"comms";
// 			wspath = "ws"+(document.location.protocol=="https:"?"s":"")+"://"+path;
// 	}

let server: http.Server | undefined;
let app: express.Express | undefined;
let nodeRedWebViewPanel: vscode.WebviewPanel | undefined;
let listenPort = 0;

const nodeRedSettings: NodeRedSettings = {
	httpAdminRoot: '/red',
	httpNodeRoot: '/api',
	functionGlobalContext: {},
	uiHost: '127.0.0.1',
	uiPort: 65000,
	userDir: '/Users/scottpage/Documents/testing/vscode-extension-samples/proposed-api-sample/node-red',
	credentialSecret: 'visualcal',
	flowFilePretty: true
};

export function activate(context: vscode.ExtensionContext) {
	if (!app) {
		app = express();
		app.use((req, _, next) => {
			console.info(req.url);
			next();
		});
		app.use(cors());
		app.use('/', express.static('public'));
		server = http.createServer(app);

		app.get('/red/red/red.js', async (_, res) => {
			const redJsFileBuffer = await fsExtra.readFile(path.join(__dirname, '..', 'node_modules', '@node-red', 'editor-client', 'public', 'red', 'red.js'));
			const redJsFileContentsString = redJsFileBuffer.toString().replace('var port = 65000;', `var port = ${listenPort};`);
			return res.send(redJsFileContentsString);
		});

		server.listen(listenPort, async () => {
			listenPort = server ? (server.address() as AddressInfo).port : 0;
			vscode.window.showInformationMessage(`Listening on port ${listenPort}`);
			if (!server || !app) return;
			nodeRedSettings.uiPort = listenPort;
			RED.init(server, nodeRedSettings);
			if (nodeRedSettings.httpAdminRoot) app.use(nodeRedSettings.httpAdminRoot, RED.httpAdmin);
			if (nodeRedSettings.httpNodeRoot) app.use(nodeRedSettings.httpNodeRoot, RED.httpNode);
			await RED.start();
		});
	}
	console.log('Congratulations, your extension "proposed-api-sample" is now active!');

	/**
	 * You can use proposed API here. `vscode.` should start auto complete
	 * Proposed API as defined in vscode.proposed.d.ts.
	 */

	const disposable = vscode.commands.registerCommand('extension.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World!');
		nodeRedWebViewPanel = vscode.window.createWebviewPanel('node-red', 'VisualCal', vscode.ViewColumn.One);
		nodeRedWebViewPanel.webview.options = {
			enableCommandUris: true,
			enableScripts: true,
			portMapping: [ { extensionHostPort: listenPort, webviewPort: listenPort }, { extensionHostPort: listenPort, webviewPort: 80 } ]
		};
		nodeRedWebViewPanel.webview.html = getWebviewContent();
	});

	context.subscriptions.push(disposable);
}

/**
 * Taken from the node-red index.html file, but added the base tag to make this work.
 */
function getWebviewContent() {
  return `<!DOCTYPE html>
	<html>
	
	<head>
		<base href="http://127.0.0.1:${listenPort}/red/" target="_blank">
		<meta charset="utf-8">
		<meta http-equiv="X-UA-Compatible" content="IE=edge" />
		<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
		<meta name="apple-mobile-web-app-capable" content="yes">
		<meta name="mobile-web-app-capable" content="yes">
		<title>VisualCal Logic Editor</title>
		<link rel="icon" type="image/png" href="favicon.ico">
		<link rel="mask-icon" href="red/images/node-red-icon-black.svg" color="#8f0000">
		<link rel="stylesheet" href="vendor/jquery/css/base/jquery-ui.min.css">
		<link rel="stylesheet" href="vendor/font-awesome/css/font-awesome.min.css">
		<link rel="stylesheet" href="red/style.min.css">
	</head>
	
	<body spellcheck="false">
		<div id="red-ui-editor"></div>
		<script src="vendor/vendor.js"></script>
		<script src="red/red.js"></script>
		<script src="red/main.js"></script>
	</body>
	</html>`;
}
