import 'dotenv/config'
import express from 'express'
import { booksRouter } from './routes/books'

const app = express()
const PORT = process.env.API_PORT ?? 3001

app.use(express.json())
app.use('/api/books', booksRouter)

app.listen(PORT, () => {
  console.log(`[server] API server running on http://localhost:${PORT}`)
})
