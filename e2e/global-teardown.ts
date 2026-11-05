import { cleanup } from "./support/seed";

export default async function globalTeardown() {
  await cleanup();
}
