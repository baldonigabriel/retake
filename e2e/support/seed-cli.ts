/**
 * Seeds (or removes) the e2e data outside Playwright, for manual visual checks:
 *   pnpm e2e:seed          → prints the session cookies
 *   pnpm e2e:seed --clean  → removes everything
 */
import { cleanup, seed } from "./seed";

async function main() {
  if (process.argv.includes("--clean")) {
    await cleanup();
    console.log("e2e data removed");
    return;
  }
  console.log(JSON.stringify(await seed(), null, 2));
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
