import log from 'loglevel';

const env = import.meta.env.MODE || 'development'; 

if (env === 'production') {
  log.setLevel('warn'); 
} else {
  log.setLevel('info'); 
}

export default log;
