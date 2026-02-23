import OpenAI from "openai";
import fs from "fs";

function readFile(filepath: string): void {
  const file = new File([], filepath);
  fs.readFile(filepath, "utf-8", (err, contents) => {
    console.log(contents);
  });
}

async function main() {
  const [, , flag, prompt] = process.argv;
  const apiKey = process.env.OPENROUTER_API_KEY;
  const baseURL =
    process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }
  if (flag !== "-p" || !prompt) {
    throw new Error("error: -p flag is required");
  }

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL,
  });

  const response = await client.chat.completions.create({
    model: "anthropic/claude-haiku-4.5",
    messages: [{ role: "user", content: prompt }],
    tools: [{
      type: "function",
      function: {
        name: "Read",
        description: "Read and return the contents of a file",
        parameters: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "The path to the file to read"
            }
          },
          required: ["file_path"]
        }
      }
    }],
  });

  if (!response.choices || response.choices.length === 0) {
    throw new Error("no choices in response");
  }

  // Execute 1st tool call in response (if it's "read")
  const response_choice = response.choices.at(0);
  if (response_choice) {
    const response_msg = response_choice.message;
    if (response_msg.tool_calls && response_msg.tool_calls.at(0)) {
      const tool_call = response_msg.tool_calls.at(0) as OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall;
      if (tool_call.function.name.toLowerCase() === "read") {
        let args_object;
        try {
          args_object = JSON.parse(tool_call.function.arguments)
        } catch {
          console.log("Invalid arguments for Read tool");
        }
        if (args_object.file_path) {
          readFile(args_object.file_path);
        }
      }
    }
  }

  // You can use print statements as follows for debugging, they'll be visible when running tests.
  //console.error("Logs from your program will appear here!");

  // TODO: Uncomment the lines below to pass the first stage
  console.log(response.choices[0].message.content);
}

main();
