import { program } from 'commander';

program.option('--config.file', 'Config file path');

program.parse();

console.log(program.options);
