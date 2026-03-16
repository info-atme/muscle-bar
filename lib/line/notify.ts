const LINE_API_URL = 'https://api.line.me/v2/bot/message/push'

type SendLineMessageParams = {
  to: string
  message: string
}

export async function sendLineMessage({ to, message }: SendLineMessageParams) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) {
    console.error('LINE_CHANNEL_ACCESS_TOKEN is not set')
    return
  }

  const res = await fetch(LINE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to,
      messages: [
        {
          type: 'text',
          text: message,
        },
      ],
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`LINE API error: ${res.status} ${body}`)
  }
}
