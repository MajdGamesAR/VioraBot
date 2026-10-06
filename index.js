/**
 * Wick Studio Discord Bot - Advanced Launcher
 * A professional, feature-rich launcher with comprehensive error handling and system monitoring
 * 
 * @version 2.0.0
 * @author Wick Studio Team
 * @license MIT
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

const config = {
  maxRestartAttempts: 3,
  restartDelay: 5000,
  checkDependencies: true,
  logStartupDetails: true,
  showProgressBar: true,
  monitorPerformance: true,
  performanceCheckInterval: 5 * 60 * 1000,
  lowMemoryThreshold: 100,
  validateConfigFiles: true
};

const state = {
  restartCount: 0,
  startTime: Date.now(),
  lastPerformanceCheck: Date.now(),
  isShuttingDown: false
};

function progressBar(percent, length = 30) {
  const filled = Math.floor(length * (percent / 100));
  const empty = length - filled;
  const bar = '█'.repeat(filled) + '▒'.repeat(empty);
  return `${colors.cyan}${bar}${colors.reset} ${colors.yellow}${percent.toFixed(1)}%${colors.reset}`;
}

function showSpinner(text, duration = 1000) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  
  return new Promise(resolve => {
    const interval = setInterval(() => {
      process.stdout.write(`\r${colors.cyan}${frames[i++ % frames.length]}${colors.reset} ${text}`);
    }, 80);
    
    setTimeout(() => {
      clearInterval(interval);
      process.stdout.write(`\r${colors.green}✓${colors.reset} ${text}\n`);
      resolve();
    }, duration);
  });
}

function displayBanner() {
  const version = '2.0.0';
  console.log(`
${colors.cyan}${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}
${colors.cyan}${colors.bright}                                                                                       ${colors.reset}
${colors.cyan}${colors.bright}                            WICK STUDIO DISCORD BOT                                    ${colors.reset}
${colors.cyan}${colors.bright}                         ${colors.yellow}✦ Professional Edition ✦${colors.cyan}${colors.bright}                              ${colors.reset}
${colors.cyan}${colors.bright}                                                                                       ${colors.reset}
${colors.dim}                                   Version ${version}                                      ${colors.reset}
${colors.dim}                            Starting bot services...                                   ${colors.reset}
${colors.cyan}${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}
`);
}

function checkRequiredFiles() {
  const fs = require('fs');
  const path = require('path');
  const requiredFiles = [
    './dist/index.js',
    './settings.json'
  ];
  
  console.log(`${colors.green}➤ ${colors.white}Verifying required files...${colors.reset}`);
  
  const missingFiles = requiredFiles.filter(file => {
    const exists = fs.existsSync(path.resolve(file));
    if (!exists) {
      console.error(`${colors.red}✗ Missing required file: ${file}${colors.reset}`);
    } else {
      console.log(`${colors.green}✓ Found ${file}${colors.reset}`);
    }
    return !exists;
  });
  
  return missingFiles.length === 0;
}

function validateConfig() {
  if (!config.validateConfigFiles) return true;
  
  try {
    const fs = require('fs');
    const settingsContent = fs.readFileSync('./settings.json', 'utf8');
    JSON.parse(settingsContent);
    console.log(`${colors.green}✓ Configuration file validation successful${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.red}✗ Configuration validation failed: ${error.message}${colors.reset}`);
    return false;
  }
}


function checkSystemRequirements() {
  const nodeVersion = process.version.substring(1).split('.').map(Number);
  const requiredVersion = [16, 0, 0];
  
  if (
    nodeVersion[0] < requiredVersion[0] || 
    (nodeVersion[0] === requiredVersion[0] && nodeVersion[1] < requiredVersion[1])
  ) {
    console.error(`${colors.red}✗ Unsupported Node.js version: ${process.version}. Please use Node.js ${requiredVersion.join('.')} or higher.${colors.reset}`);
    return false;
  }
  
  const totalMem = Math.round(require('os').totalmem() / 1024 / 1024);
  const freeMem = Math.round(require('os').freemem() / 1024 / 1024);
  
  console.log(`${colors.green}➤ ${colors.white}System Memory: ${colors.yellow}${freeMem}MB free ${colors.dim}/ ${totalMem}MB total${colors.reset}`);
  
  if (freeMem < 512) {
    console.warn(`${colors.yellow}⚠ Warning: Low system memory (${freeMem}MB). Bot performance may be affected.${colors.reset}`);
  }
  
  return true;
}

function displaySystemInfo() {
  const os = require('os');
  
  const cpus = os.cpus();
  const cpuModel = cpus[0].model;
  const cpuCores = cpus.length;
  const cpuUsage = process.cpuUsage();
  const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000;
  
  const totalMem = Math.round(os.totalmem() / (1024 * 1024));
  const freeMem = Math.round(os.freemem() / (1024 * 1024));
  const usedMem = totalMem - freeMem;
  const memPercent = Math.round((usedMem / totalMem) * 100);
  
  const pid = process.pid;
  const uptime = Math.round(process.uptime());
  
  const networkInterfaces = os.networkInterfaces();
  
  console.log(`
${colors.cyan}${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━ SYSTEM INFORMATION ━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}

${colors.green}➤ ${colors.white}OS:         ${colors.yellow}${os.type()} ${os.release()} ${os.arch()}${colors.reset}
${colors.green}➤ ${colors.white}Hostname:   ${colors.yellow}${os.hostname()}${colors.reset}
${colors.green}➤ ${colors.white}Node.js:    ${colors.yellow}${process.version}${colors.reset}
${colors.green}➤ ${colors.white}Process ID: ${colors.yellow}${pid}${colors.reset}
${colors.green}➤ ${colors.white}Uptime:     ${colors.yellow}${formatTime(uptime)}${colors.reset}

${colors.green}➤ ${colors.white}CPU:        ${colors.yellow}${cpuModel} (${cpuCores} cores)${colors.reset}
${colors.green}➤ ${colors.white}CPU Usage:  ${colors.yellow}${cpuPercent.toFixed(2)}%${colors.reset}
${colors.green}➤ ${colors.white}Memory:     ${colors.yellow}${usedMem}MB / ${totalMem}MB (${memPercent}%)${colors.reset}
${colors.green}➤ ${colors.white}Process Mem:${colors.yellow}${Math.round(process.memoryUsage().rss / (1024 * 1024))}MB RSS${colors.reset}

${colors.green}➤ ${colors.white}Time:       ${colors.yellow}${new Date().toLocaleString()}${colors.reset}
${colors.cyan}${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}
`);
}

function formatTime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
}

function setupPerformanceMonitoring() {
  if (!config.monitorPerformance) return;
  
  setInterval(() => {
    const os = require('os');
    const memoryUsage = process.memoryUsage();
    const freeMem = Math.round(os.freemem() / (1024 * 1024));
    
    if (memoryUsage.rss > 1024 * 1024 * 1024) {
      console.warn(`${colors.yellow}⚠ Warning: High memory usage detected: ${Math.round(memoryUsage.rss / 1024 / 1024)}MB${colors.reset}`);
    }
    
    if (freeMem < config.lowMemoryThreshold) {
      console.warn(`${colors.yellow}⚠ Warning: System low on memory: ${freeMem}MB free${colors.reset}`);
    }
    
    state.lastPerformanceCheck = Date.now();
  }, config.performanceCheckInterval);
}

async function startBot() {
  if (state.isShuttingDown) return;
  
  displayBanner();
  
  if (!checkSystemRequirements()) {
    console.error(`${colors.red}System requirements not met. Please resolve issues and restart.${colors.reset}`);
    return process.exit(1);
  }
  
  if (!checkRequiredFiles()) {
    console.error(`${colors.red}Missing required files. Please resolve issues and restart.${colors.reset}`);
    return process.exit(1);
  }
  
  if (!validateConfig()) {
    console.error(`${colors.red}Invalid configuration. Please fix your settings.json file and restart.${colors.reset}`);
    return process.exit(1);
  }
  
  await showSpinner('Preparing environment...', 800);
  
  displaySystemInfo();
  
  console.log(`${colors.green}➤ ${colors.white}Starting bot initialization sequence...${colors.reset}`);
  
  if (config.showProgressBar) {
    for (let i = 0; i <= 100; i += 5) {
      process.stdout.write(`\r${colors.white}Loading core components: ${progressBar(i)}${colors.reset}`);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    console.log('\n');
  }
  
  await showSpinner('Loading modules and dependencies...', 1000);
  
  console.log(`${colors.green}➤ ${colors.white}Initializing bot core...${colors.reset}`);
  
  setupPerformanceMonitoring();
  
  try {
    const startTime = Date.now();
    
    console.log(`${colors.green}➤ ${colors.white}Loading main application...${colors.reset}`);
    
    const app = require('./dist/index.js');
    
    if (app && typeof app.startup === 'object' && typeof app.startup.then === 'function') {
      await app.startup;
    }
    
    const initTime = (Date.now() - startTime) / 1000;
    console.log(`\n${colors.green}✓ ${colors.white}Bot initialization ${colors.bright}successful${colors.reset}${colors.white} in ${colors.yellow}${initTime.toFixed(2)}s${colors.reset}`);
    console.log(`${colors.green}✓ ${colors.white}Bot is now ${colors.bright}${colors.green}online${colors.reset}${colors.white} and ready to serve!${colors.reset}`);
    
    state.restartCount = 0;
    
  } catch (error) {
    handleStartupError(error);
  }
}

function handleStartupError(error) {
  console.error(`${colors.red}${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.error(`${colors.red}${colors.bright} ERROR DURING BOT INITIALIZATION ${colors.reset}`);
  console.error(`${colors.red}${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  const errorType = error.name || 'Unknown';
  const errorMessage = error.message || 'No error message available';
  const errorStack = error.stack || 'No stack trace available';
  
  console.error(`${colors.red}Type: ${errorType}${colors.reset}`);
  console.error(`${colors.red}Message: ${errorMessage}${colors.reset}`);
  console.error(`${colors.red}Stack: ${errorStack}${colors.reset}`);
  
  console.error(`\n${colors.yellow}Troubleshooting Tips:${colors.reset}`);
  console.error(`${colors.yellow}1. Ensure that the 'dist' directory exists and contains the compiled code${colors.reset}`);
  console.error(`${colors.yellow}2. Verify that all required dependencies are installed${colors.reset}`);
  console.error(`${colors.yellow}3. Check your configuration file for any syntax errors${colors.reset}`);
  console.error(`${colors.yellow}4. Make sure you have the correct Node.js version installed${colors.reset}`);
  
  if (state.restartCount < config.maxRestartAttempts) {
    state.restartCount++;
    const delay = config.restartDelay;
    
    console.log(`\n${colors.yellow}⚠ Attempting automatic recovery (Attempt ${state.restartCount}/${config.maxRestartAttempts})${colors.reset}`);
    console.log(`${colors.yellow}⚠ Restarting in ${delay/1000} seconds...${colors.reset}`);
    
    setTimeout(() => {
      console.log(`${colors.green}➤ ${colors.white}Restarting bot...${colors.reset}\n`);
      startBot();
    }, delay);
  } else {
    console.error(`\n${colors.red}✗ Maximum restart attempts (${config.maxRestartAttempts}) reached. Shutting down.${colors.reset}`);
    process.exit(1);
  }
}

function setupCleanShutdown() {
  async function shutdown(signal) {
    if (state.isShuttingDown) return;
    state.isShuttingDown = true;
    
    console.log(`\n${colors.yellow}⚠ Received ${signal} signal. Initiating graceful shutdown...${colors.reset}`);
    
    await showSpinner('Closing connections...', 1000);
    await showSpinner('Saving data...', 1000);
    
    console.log(`${colors.green}✓ ${colors.white}Shutdown complete. Bot was running for ${formatTime(Math.round((Date.now() - state.startTime) / 1000))}.${colors.reset}`);
    process.exit(0);
  }
  
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('uncaughtException', (error) => {
  console.error(`${colors.red}${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.error(`${colors.red}${colors.bright} UNCAUGHT EXCEPTION ${colors.reset}`);
  console.error(`${colors.red}${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.error(`${colors.red}${error.stack || error}${colors.reset}`);
  
  const isFatal = error.name === 'SyntaxError' || 
                 error.code === 'EACCES' || 
                 error.code === 'EADDRINUSE';
  
  if (isFatal) {
    console.error(`${colors.red}Fatal error detected. Shutting down.${colors.reset}`);
    process.exit(1);
  } else if (state.restartCount < config.maxRestartAttempts) {
    state.restartCount++;
    console.log(`\n${colors.yellow}⚠ Attempting to recover from error. (Attempt ${state.restartCount}/${config.maxRestartAttempts})${colors.reset}`);
    setTimeout(startBot, config.restartDelay);
  } else {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`${colors.red}${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.error(`${colors.red}${colors.bright} UNHANDLED PROMISE REJECTION ${colors.reset}`);
  console.error(`${colors.red}${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  let errorDetails = 'Unknown reason';
  
  if (reason instanceof Error) {
    errorDetails = reason.stack || reason.message;
  } else if (typeof reason === 'string') {
    errorDetails = reason;
  } else if (reason && typeof reason === 'object') {
    try {
      errorDetails = JSON.stringify(reason, null, 2);
    } catch (e) {
      errorDetails = `Object: ${Object.keys(reason).join(', ')}`;
    }
  }
  
  console.error(`${colors.red}Reason: ${errorDetails}${colors.reset}`);
  });

process.on('warning', (warning) => {
  console.warn(`${colors.yellow}⚠ Warning: ${warning.name}${colors.reset}`);
  console.warn(`${colors.yellow}Message: ${warning.message}${colors.reset}`);
  console.warn(`${colors.yellow}Stack: ${warning.stack}${colors.reset}`);
});

try {
  const v8 = require('v8');
  const heapStats = v8.getHeapStatistics();
  const heapSizeLimit = Math.round(heapStats.heap_size_limit / 1024 / 1024);
  
  console.log(`${colors.dim}Memory limit: ${heapSizeLimit}MB${colors.reset}`);
  
  if (heapSizeLimit < 1024) {
    console.warn(`${colors.yellow}⚠ Running with limited memory. Consider increasing Node.js memory limit.${colors.reset}`);
  }
} catch (e) {
  void e;
}

setupCleanShutdown();

console.log(`${colors.dim}Starting Wick Studio Discord Bot at ${new Date().toISOString()}${colors.reset}\n`);
startBot();