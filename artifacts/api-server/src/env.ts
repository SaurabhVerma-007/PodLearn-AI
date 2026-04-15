import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(dir, "../../../.env");

config({ path: envPath, override: false });
