export async function handler(event) {
  const body = JSON.parse(event.body);

  console.log("Webhook recebido: ", body);

  return {
    statusCode: 200,
    body: "OK",
  };
}
