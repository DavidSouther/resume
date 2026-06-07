import { join } from "node:path";
import { cwd } from "node:process";
import { parseArgs } from "node:util";
import { makeServer } from "@davidsouther/jiffies/server/http/index.ts";

// Serves the built static site in docs/ over HTTP using the jiffies server's
// static-file + directory-index middleware, so clean URLs like /blog/ resolve
// to /blog/index.html. Run after `npm run build`. Override with
// `npm start -- --port 3000 --host 0.0.0.0`.
const { values } = parseArgs({
	options: {
		port: { type: "string", default: "8080" },
		host: { type: "string", default: "127.0.0.1" },
	},
});

const server = await makeServer({ root: join(cwd(), "docs") });
server.listen(Number.parseInt(values.port, 10), values.host);
