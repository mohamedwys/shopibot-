import type { LoaderFunctionArgs } from "@remix-run/node";
import { readFile } from "fs/promises";
import { join } from "path";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Read the widget CSS file from extensions folder
    const cssPath = join(
      process.cwd(),
      "extensions",
      "sales-assistant-widget",
      "assets",
      "ai-sales-assistant.css"
    );
    
    const cssContent = await readFile(cssPath, "utf-8");

    return new Response(cssContent, {
      status: 200,
      headers: {
        "Content-Type": "text/css; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    console.error("❌ Error loading widget.css:", error);
    
    return new Response(
      `/* Widget styles not found */\n/* Error: ${error instanceof Error ? error.message : 'Unknown error'} */`,
      { 
        status: 500,
        headers: {
          "Content-Type": "text/css",
          "Access-Control-Allow-Origin": "*",
        }
      }
    );
  }
}

export async function options() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}