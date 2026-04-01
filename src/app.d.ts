declare global {
  namespace App {
    interface Locals {
      userId?: string
    }
    interface PageData {
      user: { id: string; email: string; name: string } | null
    }
  }
}

export {}
