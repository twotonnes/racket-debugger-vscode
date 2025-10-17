import * as vscode from 'vscode';
import { RacketDebugAdapterDescriptorFactory } from './racketDebugAdapter';

let factory: RacketDebugAdapterDescriptorFactory | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('Racket debugger ready');

    factory = new RacketDebugAdapterDescriptorFactory();
    context.subscriptions.push(
        vscode.debug.registerDebugAdapterDescriptorFactory('racket', factory)
    );
    context.subscriptions.push(
        vscode.debug.registerDebugConfigurationProvider('racket', {
            provideDebugConfigurations(folder: vscode.WorkspaceFolder | undefined) {
                return [
                    {
                        type: 'racket',
                        name: 'Debug Racket Program',
                        request: 'launch',
                        program: '${file}'
                    }
                ];
            },
            resolveDebugConfiguration(
                folder: vscode.WorkspaceFolder | undefined,
                config: vscode.DebugConfiguration
            ) {
                // If launch.json is missing or empty
                if (!config.type && !config.name) {
                    config = {
                        type: 'racket',
                        name: 'Debug Racket Program',
                        request: 'launch',
                        program: '${file}'
                    };
                }

                // If no program is specified, use the current file
                if (!config.program) {
                    config.program = '${file}';
                }
                return config;
            }
        })
    );
}

export function deactivate() {
    if (factory) {
        factory.dispose();
        factory = undefined;
    }
}
