import OpenAI from "openai";
import fs from "fs";
import child_process from "child_process";

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

  let messages_arr: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  let continue_conversation = true;

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
      },
      {
        type: "function",
        function: {
          name: "Write",
          description: "Write content to a file",
          parameters: {
            type: "object",
            required: ["file_path", "content"],
            properties: {
              file_path: {
                type: "string",
                description: "The path of the file to write to"
              },
              content: {
                type: "string",
                description: "The content to write to the file"
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "Bash",
          description: "Execute a shell command",
          parameters: {
            type: "object",
            required: ["command"],
            properties: {
              command: {
                type: "string",
                description: "The command to execute"
              }
            }
          }
        }
      }],
    });

    if (!response.choices || response.choices.length === 0) {
      throw new Error("no choices in response");
    }

    const next_message = response.choices.at(0)!.message;
    messages_arr = messages_arr.concat([next_message]);

    // If there are no tool calls, then the conversation is over
    if (!next_message.tool_calls || next_message.tool_calls.length === 0) {
      console.log(next_message.content);
      continue_conversation = false;
    } else {
      for (let i = 0; i < next_message.tool_calls.length; i++) {
        const tool_call = next_message.tool_calls.at(i) as OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall;
        // Type "any" b/c "model does not always generate valid JSON"
        let args_object: any;
        let tool_output: string = "";

        if (tool_call.function.name.toLowerCase() === "read") {
          try {
            args_object = JSON.parse(tool_call.function.arguments)
          } catch {
            console.log("Invalid arguments for Read tool");
          }
          if (args_object.file_path) {
            tool_output = fs.readFileSync(args_object.file_path, "utf-8");
          }
        }

        if (tool_call.function.name.toLowerCase() === "write") {
          try {
            args_object = JSON.parse(tool_call.function.arguments);
          } catch {
            console.log("Invalid arguments for Write tool");
          }
          if (args_object.file_path && args_object.content) {
            fs.writeFileSync(args_object.file_path, args_object.content);
            tool_output = "Created the file";
          }
        }

        if (tool_call.function.name.toLowerCase() === "bash") {
          try {
            args_object = JSON.parse(tool_call.function.arguments);
          } catch {
            console.log("Invalid arguments for Bash tool");
          }
          if (args_object.command) {
            try {
              tool_output = child_process.execSync(args_object.command).toString();
            } catch {
              tool_output = "Error encountered while executing command";
            }
          }
        }

        messages_arr = messages_arr.concat([{
          role: "tool",
          tool_call_id: tool_call.id,
          content: "FUCK YOU"
        }]);
      }
    }

  } while (continue_conversation);
}

main();
