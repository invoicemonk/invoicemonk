import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'

Deno.test('lifecycle campaign delivery defaults to test mode', async () => {
  const source = await Deno.readTextFile(new URL('./index.ts', import.meta.url))
  assertEquals(source.includes("Deno.env.get('LIFECYCLE_EMAIL_TEST_MODE') ?? 'true'"), true)
  assertEquals(source.includes('testRecipients.includes(toEmail.toLowerCase())'), true)
  assertEquals(source.includes('`[TEST] ${subject}`'), true)
})