import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import * as net from 'net';

export class RacketDebugAdapterDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {
    private server?: net.Socket;
    private racketProcess?: ChildProcess;

    async createDebugAdapterDescriptor(
        session: vscode.DebugSession
    ): Promise<vscode.DebugAdapterDescriptor | undefined> {
        // Kill any existing Racket process
        if (this.racketProcess) {
            console.log('Cleaning up previous debug session...');
            this.racketProcess.kill();
            this.racketProcess = undefined;
        }

        // Start the Racket debugger process
        console.log('Initializing Racket debugger...');
        this.racketProcess = spawn('racket', ['-l', 'dap-debugger']);

        // Log output and errors
        this.racketProcess.stdout?.on('data', (data) => {
            const output = data.toString().trim();
            if (output) console.log('Debugger:', output);
        });

        this.racketProcess.stderr?.on('data', (data) => {
            const error = data.toString().trim();
            if (error) console.warn('Debugger error:', error);
        });

        this.racketProcess.on('close', (code) => {
            if (code !== 0) {
                console.error(`Debug session ended unexpectedly (exit code: ${code})`);
            }
            this.racketProcess = undefined;
        });

        // Wait for TCP connection with timeout
        try {
            await this.waitForTcpConnection(60000); // 60 second timeout
            console.log('Launching debug session with adapter running on localhost:4142');
            return new vscode.DebugAdapterServer(4142, 'localhost');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to connect to Racket debugger: ${error}`);
            if (this.racketProcess) {
                this.racketProcess.kill();
                this.racketProcess = undefined;
            }
            return undefined;
        }
    }

    dispose() {
        if (this.server) {
            this.server.destroy();
            this.server = undefined;
        }
        if (this.racketProcess) {
            this.racketProcess.kill();
            this.racketProcess = undefined;
        }
        console.log('Debug session ended');
    }

    private waitForTcpConnection(timeout: number): Promise<void> {
        console.log('Waiting for debugger to initialize...');
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                if (this.server) {
                    this.server.destroy();
                    this.server = undefined;
                }
                reject(new Error('Debugger failed to start within 60 seconds'));
            }, timeout);

            let attemptCount = 0;
            const tryConnect = () => {
                attemptCount++;
                if (attemptCount === 1) {
                    console.log('Establishing connection to debugger...');
                }

                if (this.server) {
                    this.server.destroy();
                }

                this.server = new net.Socket();

                this.server.on('connect', () => {
                    console.log('Successfully connected to debugger');
                    clearTimeout(timeoutId);
                    resolve();
                });

                this.server.on('error', (error: Error & { code?: string }) => {
                    if (error.code === 'ECONNREFUSED') {
                        // Only log every 5 seconds to avoid spam
                        if (attemptCount % 5 === 1) {
                            console.log('Waiting for debugger to be ready...');
                        }
                        setTimeout(tryConnect, 1000);
                    } else {
                        console.error('Failed to connect to debugger:', error.message);
                        clearTimeout(timeoutId);
                        reject(error);
                    }
                });

                this.server.connect(4142, 'localhost');
            };

            tryConnect();
        });
    }
}