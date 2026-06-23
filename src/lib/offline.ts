import { openDB } from 'idb'
import type { AppSnapshot, OfflineJob } from '../types'

const DB_NAME = 'compacc-pwa'
const DB_VERSION = 1

const database = () =>
  openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('jobs')) {
        const jobs = db.createObjectStore('jobs', { keyPath: 'id' })
        jobs.createIndex('createdAt', 'createdAt')
      }
      if (!db.objectStoreNames.contains('snapshots')) db.createObjectStore('snapshots')
    }
  })

export const offlineStore = {
  async listJobs() {
    const db = await database()
    return (await db.getAllFromIndex('jobs', 'createdAt')) as OfflineJob[]
  },
  async putJob(job: OfflineJob) {
    const db = await database()
    await db.put('jobs', job)
  },
  async deleteJob(id: string) {
    const db = await database()
    await db.delete('jobs', id)
  },
  async saveSnapshot(tenantId: string, snapshot: AppSnapshot) {
    const db = await database()
    await db.put('snapshots', snapshot, tenantId)
  },
  async getSnapshot(tenantId: string) {
    const db = await database()
    return (await db.get('snapshots', tenantId)) as AppSnapshot | undefined
  }
}
