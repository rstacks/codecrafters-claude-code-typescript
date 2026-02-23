import OpenAI from "openai";
import fs from "fs";

function readFile(filepath: string): string {
  const file = new File([], filepath);
  return fs.readFileSync(filepath, "utf-8");
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

  // Can't be fucked to list every single possible message type
  let messages_arr: any = [{ role: "user", content: prompt }];

  do {
    const response = await client.chat.completions.create({
      model: "anthropic/claude-haiku-4.5",
      messages: messages_arr,
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

    const next_message = response.choices.at(0)!.message;
    messages_arr = messages_arr.concat([next_message]);

    // Execute tool calls in response
    if (next_message.tool_calls) {
      if (next_message.tool_calls.length === 0) {
        // End conversation
        console.log(next_message.content);
        break;
      }
      for (let i = 0; i < next_message.tool_calls.length; i++) {
        const tool_call = next_message.tool_calls.at(i) as OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall;
        if (tool_call.function.name.toLowerCase() === "read") {
          let args_object;
          try {
            args_object = JSON.parse(tool_call.function.arguments)
          } catch {
            console.log("Invalid arguments for Read tool");
          }
          if (args_object.file_path) {
            const file_contents = readFile(args_object.file_path);
            messages_arr = messages_arr.concat([{
              role: "tool",
              tool_call_id: tool_call.id,
              content: file_contents
            }]);
          }
        }
      }
    } else {
      // End conversation
      console.log(response.choices[0].message.content);
      break;
    }
  } while (true);

  // You can use print statements as follows for debugging, they'll be visible when running tests.
  //console.error("Logs from your program will appear here!");
}

main();
