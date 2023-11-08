import { exec } from 'child_process';

export default async function globalTeardown() {
  exec(
    'echo "{}" | tee tests/assets/small_infra/infra.json && rm tests/assets/small_infra/external_generated_inputs.json && rm tests/assets/small_infra/simulation.json',
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
