
DO $$
DECLARE
  test_user_ids uuid[] := ARRAY[
    '4d4adcb5-90bd-487e-b9fb-d2558db3f35c','9d7f3b9f-c525-48a5-b72f-189fbd59e2cf',
    '3d10615a-c870-412c-b747-69d83c27bdd2','d12b7835-9a59-4cec-8544-d976ee2b4a5e',
    '76b9b28e-f5f4-4ede-b609-1e306f5898dc','1516c849-33ab-438f-8787-51d5fb137e07',
    '8eb399d4-97d3-488f-98d1-422eb67f7d88','c9bef287-6750-4e7c-95b7-0d82d21db976',
    '43bd1fe9-b634-478b-9606-b34838e6277f','aa9d1a81-f5f5-4347-8fad-b0b117958ed6',
    'badc10a0-27fd-4c7c-80d0-9243083e94c0','923d9707-c831-41c1-b3c9-83601939c0b4',
    '6a62b86a-7df3-4c0a-bc9c-bae4b2cce2b7','0505af83-636a-4a89-8a4a-b5f53c507e6d',
    '444810dc-29ec-4913-8a42-09e979b04d0c'
  ];
  test_business_ids uuid[] := ARRAY[
    '2770739c-7860-4ae1-b4b2-6555d9cb8b06','f7fd7ac8-c675-48b3-a366-14b86129a36f',
    'ad3eda27-aede-4d5a-a780-2711eccd2803','ce386f7b-5fcc-4597-86d2-877586d86246',
    'f722d048-f247-4030-8708-edc74f9a8d33','f5509e60-9e9d-410b-8a18-a12e2fe0fdf6',
    'd2c5ea9e-8841-494d-89c9-c6397c2c9c72','99c1c8eb-f4dc-4415-896d-06ddc00be6a2',
    '87213224-a04c-43a6-89e9-d68145f6f661','3cbec3e9-fadb-4141-9c32-1e12a8c8d973',
    'cf7dd4b5-211c-4f89-a586-edcfe0b08281','79ef940a-fc67-448c-8da6-cbd7fa03d45f',
    'c14e5b3f-befa-44db-8d29-00256425f900','fb0a190c-5e03-4f53-b6ad-4425ac90936b',
    'cff0901d-d5b3-4f6b-a6a1-ad0a6afef8aa'
  ];
BEGIN
  -- Clean referrals first
  DELETE FROM referrals WHERE referred_user_id = ANY(test_user_ids);
  -- Then the rest
  DELETE FROM business_compliance_analytics WHERE business_id = ANY(test_business_ids);
  DELETE FROM clients WHERE business_id = ANY(test_business_ids);
  DELETE FROM currency_accounts WHERE business_id = ANY(test_business_ids);
  DELETE FROM notifications WHERE user_id = ANY(test_user_ids);
  DELETE FROM lifecycle_events WHERE user_id = ANY(test_user_ids);
  DELETE FROM subscriptions WHERE user_id = ANY(test_user_ids);
  DELETE FROM user_roles WHERE user_id = ANY(test_user_ids);
  DELETE FROM business_members WHERE user_id = ANY(test_user_ids);
  DELETE FROM businesses WHERE id = ANY(test_business_ids);
  DELETE FROM profiles WHERE id = ANY(test_user_ids);
END $$;
