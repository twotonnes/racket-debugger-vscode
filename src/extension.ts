import * as vscode from 'vscode';
import * as net from 'net';
import { spawn, ChildProcess } from 'child_process';

let client: net.Socket | undefined;
let racketProcess: ChildProcess | undefined;
let statusBarItem: vscode.StatusBarItem;
let reconnectTimer: NodeJS.Timeout | undefined;
let isDisposed = false;

function startRacketDebugger() {
    if (racketProcess) {
        try {
            racketProcess.kill();
        } catch (error) {
            console.error('Error killing existing Racket process:', error);
        }
    }

    console.log('Starting Racket debugger process...');
    racketProcess = spawn('racket', ['-l', 'dap-debugger']);

    racketProcess.stdout?.on('data', (data) => {
        console.log('Racket debugger output:', data.toString());
    });

    racketProcess.stderr?.on('data', (data) => {
        console.error('Racket debugger error:', data.toString());
    });

    racketProcess.on('close', (code) => {
        console.log(`Racket debugger process exited with code ${code}`);
        racketProcess = undefined;
        if (!isDisposed) {
            // Restart the process if we're not disposing the extension
            startRacketDebugger();
        }
    });

    // Give the debugger a moment to start up before attempting to connect
    setTimeout(createConnection, 1000);
}

function createConnection() {
    if (isDisposed) return;

    console.log('Attempting to connect to TCP server on port 4142...');
    statusBarItem.text = "$(sync~spin) Connecting to Racket debugger...";
    statusBarItem.show();

    client = new net.Socket();

    client.on('connect', () => {
        console.log('Successfully connected to TCP server on port 4142');
        statusBarItem.text = "$(check) Connected to Racket debugger";
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = undefined;
        }
    });

    client.on('data', (data) => {
        console.log('Received data from server:', data.toString());
    });

    client.on('end', () => {
        console.log('Disconnected from server');
        statusBarItem.text = "$(circle-slash) Disconnected from Racket debugger";
        scheduleReconnect();
    });

    client.on('error', (error: Error & { code?: string }) => {
        if (error.code === 'ECONNREFUSED') {
            console.log('Connection refused - server not ready yet');
        } else {
            console.error('Connection error:', error);
        }
        
        if (client) {
            client.destroy();
        }
        scheduleReconnect();
    });

    try {
        // Try IPv4 first
        client.connect(4142, 'localhost');
    } catch (error) {
        console.error('Failed to initiate connection:', error);
        scheduleReconnect();
    }
}

function scheduleReconnect() {
    if (isDisposed || reconnectTimer) return;
    
    statusBarItem.text = "$(sync~spin) Waiting to reconnect...";
    console.log('Will attempt to reconnect in 2 seconds...');
    
    reconnectTimer = setTimeout(() => {
        reconnectTimer = undefined;
        createConnection();
    }, 2000);
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Racket debugger extension is now active');
    
    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
    );
    statusBarItem.text = "$(clock) Waiting for Racket debugger to start...";
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    
    // Start Racket debugger and establish initial connection
    startRacketDebugger();
}

export function deactivate() {
    isDisposed = true;
    
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
    }
    
    if (client) {
        console.log('Closing TCP connection...');
        client.end(() => {
            console.log('TCP connection closed');
        });
    }
    
    if (racketProcess) {
        console.log('Terminating Racket debugger process...');
        racketProcess.kill();
        racketProcess = undefined;
    }
    
    statusBarItem.dispose();
}
