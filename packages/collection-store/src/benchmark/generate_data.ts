import { promises as fs } from 'fs'
import path from 'path'

// --- Helper Functions ---

function getRandomInt(min: number, max: number): number {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getRandomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function getRandomString(length: number): string {
  const characters =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  return result
}

function getRandomEmail(): string {
  const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'example.org', 'test.com', 'company.net']
  const name = getRandomString(getRandomInt(5, 12)).toLowerCase()
  const domain = domains[getRandomInt(0, domains.length - 1)]
  return `${name}@${domain}`
}

function getRandomDate(startYear: number = 2020, endYear: number = 2024): Date {
  const start = new Date(startYear, 0, 1)
  const end = new Date(endYear, 11, 31)
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

function getRandomSubset<T>(arr: T[], size: number): T[] {
  const shuffled = arr.slice().sort(() => 0.5 - Math.random())
  return shuffled.slice(0, Math.min(size, arr.length))
}

function getRandomChoice<T>(arr: T[]): T {
  return arr[getRandomInt(0, arr.length - 1)]
}

// --- Extended Data Record Generation ---

export interface BenchmarkDataRecord {
  id: number
  name: string
  age: number
  tags: string[]
  nested: {
    value: string | null
    arr: number[]
    deep: {
      level: number
      active: boolean
    }
  }
  status: 'active' | 'inactive' | 'pending' | 'suspended'
  score: number
  items: string[]
  values: number[]
  scores: number[]
  flags: number
  mask: number
  counter: number
  // New fields for more diversity
  email: string
  category: 'premium' | 'standard' | 'basic' | 'trial'
  rating: number // Float rating 1.0-5.0
  metadata: {
    created: Date
    updated: Date
    version: number
    tags: string[]
  }
  profile: {
    bio: string | null
    preferences: string[]
    settings: {
      notifications: boolean
      theme: 'light' | 'dark' | 'auto'
      language: 'en' | 'ru' | 'es' | 'fr'
    }
  }
  location: {
    country: string
    city: string
    coordinates: {
      lat: number
      lng: number
    }
  }
  permissions: string[]
  stats: {
    loginCount: number
    lastActive: Date
    totalSpent: number
  }
  features: {
    [key: string]: boolean | number | string
  }
}

export function generateRecord(id: number): BenchmarkDataRecord {
  // Extended options for more variety
  const nameOptions = ['test', 'testing', 'sample', 'data', 'user', 'admin', 'guest', 'demo']
  const tagOptions = ['a', 'b', 'c', 'd', 'e', 'f', 'developer', 'designer', 'manager', 'intern', 'senior', 'junior']
  const valueOptions = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
  const categoryOptions: ('premium' | 'standard' | 'basic' | 'trial')[] = ['premium', 'standard', 'basic', 'trial']
  const statusOptions: ('active' | 'inactive' | 'pending' | 'suspended')[] = ['active', 'inactive', 'pending', 'suspended']
  const countryOptions = ['USA', 'Russia', 'Germany', 'France', 'Japan', 'Brazil', 'Canada', 'Australia']
  const cityOptions = ['New York', 'Moscow', 'Berlin', 'Paris', 'Tokyo', 'São Paulo', 'Toronto', 'Sydney']
  const permissionOptions = ['read', 'write', 'delete', 'admin', 'moderate', 'publish', 'edit', 'view']
  const preferenceOptions = ['email', 'sms', 'push', 'newsletter', 'updates', 'marketing', 'analytics']
  const bioOptions = [
    'Senior DEVELOPER with 5+ years experience',
    'Backend specialist focusing on scalability',
    'Frontend developer passionate about UX',
    'Full-stack engineer',
    'DevOps engineer',
    'Data scientist',
    'Product manager',
    null
  ]

  const createdDate = getRandomDate(2020, 2023)
  const updatedDate = new Date(createdDate.getTime() + getRandomInt(0, 365 * 24 * 60 * 60 * 1000))
  const lastActiveDate = getRandomDate(2023, 2024)

  return {
    id: id,
    name: Math.random() < 0.7
      ? nameOptions[getRandomInt(0, nameOptions.length - 1)]
      : getRandomString(getRandomInt(5, 12)),
    age: getRandomInt(18, 65),
    tags: getRandomSubset(tagOptions, getRandomInt(1, 5)),
    nested: {
      value: Math.random() < 0.8 ? getRandomString(getRandomInt(3, 10)) : null,
      arr: Array.from({ length: getRandomInt(1, 6) }, () => getRandomInt(1, 100)),
      deep: {
        level: getRandomInt(1, 10),
        active: Math.random() < 0.7
      }
    },
    status: getRandomChoice(statusOptions),
    score: getRandomInt(0, 200),
    items: Array.from({ length: getRandomInt(0, 6) }, () => getRandomString(getRandomInt(3, 8))),
    values: getRandomSubset(valueOptions, getRandomInt(1, 6)),
    scores: Array.from({ length: getRandomInt(1, 8) }, () => getRandomInt(60, 100)),
    flags: getRandomInt(0, 255), // For bitwise ops
    mask: getRandomInt(0, 255),
    counter: getRandomInt(0, 1000),

    // New diverse fields
    email: getRandomEmail(),
    category: getRandomChoice(categoryOptions),
    rating: Math.round(getRandomFloat(1.0, 5.0) * 10) / 10, // 1.0-5.0 with 1 decimal

    metadata: {
      created: createdDate,
      updated: updatedDate,
      version: getRandomInt(1, 10),
      tags: getRandomSubset(tagOptions, getRandomInt(0, 4))
    },

    profile: {
      bio: Math.random() < 0.6 ? getRandomChoice(bioOptions.filter(b => b !== null)) : null,
      preferences: getRandomSubset(preferenceOptions, getRandomInt(1, 4)),
      settings: {
        notifications: Math.random() < 0.8,
        theme: getRandomChoice(['light', 'dark', 'auto'] as const),
        language: getRandomChoice(['en', 'ru', 'es', 'fr'] as const)
      }
    },

    location: {
      country: getRandomChoice(countryOptions),
      city: getRandomChoice(cityOptions),
      coordinates: {
        lat: getRandomFloat(-90, 90),
        lng: getRandomFloat(-180, 180)
      }
    },

    permissions: getRandomSubset(permissionOptions, getRandomInt(1, 5)),

    stats: {
      loginCount: getRandomInt(0, 1000),
      lastActive: lastActiveDate,
      totalSpent: Math.round(getRandomFloat(0, 10000) * 100) / 100 // 0-10000 with 2 decimals
    },

    features: {
      darkMode: Math.random() < 0.5,
      betaAccess: Math.random() < 0.3,
      premiumFeatures: Math.random() < 0.4,
      apiAccess: Math.random() < 0.6,
      maxProjects: getRandomInt(1, 50),
      storageLimit: getRandomChoice([100, 500, 1000, 5000, 10000]), // MB
      priority: getRandomChoice(['low', 'normal', 'high', 'critical'])
    }
  }
}

// --- Main Generation Logic ---

async function generateData(count: number, outputFile: string) {
  console.log(`🔄 Generating ${count} diverse records...`)
  const data: BenchmarkDataRecord[] = []

  const progressInterval = Math.max(1, Math.floor(count / 20)) // Show progress 20 times

  for (let i = 0; i < count; i++) {
    data.push(generateRecord(i))
    if ((i + 1) % progressInterval === 0 || i === count - 1) {
      const percentage = Math.round(((i + 1) / count) * 100)
      console.log(`  📊 Generated ${i + 1}/${count} records (${percentage}%)`)
    }
  }

  const outputDir = path.dirname(outputFile)
  await fs.mkdir(outputDir, { recursive: true })

  console.log(`💾 Writing data to ${outputFile}...`)
  await fs.writeFile(outputFile, JSON.stringify(data, null, 2))

  const fileSizeKB = Math.round((JSON.stringify(data).length / 1024))
  console.log(`✅ Data generation complete! File size: ${fileSizeKB} KB`)
}

// --- Script Execution ---

async function main() {
  const args = process.argv.slice(2)
  const countArg = args[0]
  const outputArg = args[1]

  const defaultSizes = [10, 100, 1000, 10000, 100000, 1000000]
  const dataDir = path.resolve(__dirname, 'data')

  if (countArg && outputArg) {
    const count = parseInt(countArg, 10)
    if (isNaN(count) || count <= 0) {
      console.error('❌ Invalid count specified.')
      process.exit(1)
    }
    const outputFile = path.resolve(dataDir, outputArg)
    await generateData(count, outputFile)
  } else if (!countArg && !outputArg) {
    console.log('🚀 No specific count/output provided. Generating default sizes...')
    for (const size of defaultSizes) {
      const outputFile = path.resolve(dataDir, `benchmark_data_${size}.json`)
      console.log(`\n📋 Generating ${size} records...`)
      await generateData(size, outputFile)
    }
    console.log('\n🎉 All default datasets generated successfully!')
  } else {
    console.error('❌ Usage: bun generate_data.ts [count] [output_filename]')
    console.error('📝 Example: bun generate_data.ts 10000 data_10k.json')
    console.error('🔄 Or run without arguments to generate default sizes into ./data/')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('❌ Error generating data:', err)
  process.exit(1)
})
