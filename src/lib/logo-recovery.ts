/**
 * Businesses whose logo file was removed by the 15 July 2026 storage path
 * migration (object keys were rewritten in the database without moving the
 * underlying files). These are the only accounts that should see the
 * "we're restoring your logo" notice.
 */
export const AFFECTED_LOGO_BUSINESS_IDS = new Set<string>([
  '050e73c2-6c18-4d76-b03d-3f93e3555fdb',
  '1344d2d6-c0e0-4813-828d-76b67f96feec',
  '2770739c-7860-4ae1-b4b2-6555d9cb8b06',
  '27ef4234-a56a-4e50-9ff5-79303f3c8cb6',
  '347e8b2f-56c2-480a-bf5f-02ef8528f393',
  '58816778-b286-4dce-aa2a-497d75b3226e',
  '654906bf-c666-4099-92bf-e76bef0d996d',
  '66319d3d-df2f-4d8b-85da-c13e0f5f6486',
  '70255dd3-3974-49e7-8fb4-f100394e0031',
  '87d2b8b8-8b82-49a1-b00c-8a9363a26471',
  'a2190772-21a8-4d5e-bc78-3e8860a1de6d',
  'b42ad810-58cb-4ab5-a1ec-3912f830db31',
  'cd3ca130-734d-4b98-890b-6e0c3f538d3d',
  'e9d3efe8-564e-4b5d-b543-711c390622de',
  'eb5604cc-d8bb-49dc-a2ae-d99a375f3ac1',
  'f54f20d6-0e43-40cf-a960-b5fdbe59172c',
  'f689fc04-df7f-4822-ad7d-873abf3a86af',
  'ff9548b8-94a6-424d-bb7f-b6f20dd9e21d',
]);
