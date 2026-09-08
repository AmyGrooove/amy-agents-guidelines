import { Cli } from '#app/Cli';

process.exitCode = await Cli(process.argv.slice(2));
