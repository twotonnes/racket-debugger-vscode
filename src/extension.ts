import * as vscode from 'vscode';
import * as net from 'net';

/**
 * Debug adapter factory that creates debug adapter descriptors for TCP connections.
 */
class RacketDebugAdapterDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {
    createDebugAdapterDescriptor(
        session: vscode.DebugSession,
        executable: vscode.DebugAdapterExecutable | undefined
    ): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
        // Get the debug server port from the launch configuration
        const port = session.configuration.debugServer;
        
        if (typeof port !== 'number') {
            throw new Error('Debug server port must be specified in launch configuration');
        }

        // Create a debug adapter that connects to the specified port
        return new vscode.DebugAdapterServer(port, 'localhost');
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Racket debugger extension is now active');

    // Register the debug adapter factory
    const factory = new RacketDebugAdapterDescriptorFactory();
    context.subscriptions.push(
        vscode.debug.registerDebugAdapterDescriptorFactory('racket', factory)
    );
}

export function deactivate() {}
