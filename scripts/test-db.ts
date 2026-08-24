import mongoose from 'mongoose'
import dotenv from 'dotenv'

// Загружаем переменные окружения из .env файла
dotenv.config()

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI

async function testConnection() {
  if (!MONGO_URI) {
    console.error(
      '❌ Ошибка: В переменных окружения (.env) не найдена строка MONGO_URI или MONGODB_URI'
    )
    process.exit(1)
  }

  console.log('🔄 Попытка подключения к MongoDB...')

  try {
    // Подключаемся к базе (таймаут 5 секунд, чтобы не висеть долго при неверном IP)
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 })

    console.log('✅ Успешное подключение к MongoDB!')
    console.log(`📂 Имя базы данных: ${mongoose.connection.name}`)
    console.log(`🌐 Хост: ${mongoose.connection.host}`)

    // Закрываем соединение после успешного теста
    await mongoose.disconnect()
    console.log('🔌 Соединение закрыто.')
    process.exit(0)
  } catch (error) {
    console.error('❌ Не удалось подключиться к MongoDB:')
    console.error(error)
    process.exit(1)
  }
}

testConnection()
