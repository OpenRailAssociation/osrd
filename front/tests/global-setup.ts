import { exec } from 'child_process';

export default async function globalSetup() {
  exec(
    'poetry --directory ../python/railjson_generator/ run python -m railjson_generator ./tests/assets/ small_infra',
    (error, stdout, stderr) => {
      if (error) {
        console.error(`error: ${error.message}`);
      } else if (stderr) {
        console.error(`stderr: ${stderr}`);
      } else {
        console.warn(stdout);
      }
    }
  );
}
