import { spawn } from 'child_process'

const frontend = spawn('npm', ['run', 'frontend:start'], {
  stdio: 'inherit',
  shell: true,  
  cwd: process.cwd()
});

const backend = spawn('npm', ['run', 'backend:start'], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd()
});

process.on('SIGINT', () => {
  console.log('Received SIGINT. Terminating child processes...');
  frontend.kill(); // Kill frontend process
  backend.kill();  // Kill backend process
});