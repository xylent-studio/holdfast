import { expect, test } from '@playwright/test';

import {
  baseUrl,
  consumeMagicLink,
  createMagicLink,
  deleteUser,
  openSignedInSettings,
  reloadUntilTextVisible,
  waitForRemoteAttachment,
  waitForRemoteItemByTitle,
} from './hosted-auth.helpers';

const syncSmokeEnabled = process.env.PLAYWRIGHT_SYNC_SMOKE === '1';

test.describe('hosted sync smoke', () => {
  const createdUserIds = new Set<string>();

  test.skip(
    !syncSmokeEnabled || !baseUrl,
    'Hosted sync smoke needs PLAYWRIGHT_SYNC_SMOKE, PLAYWRIGHT_BASE_URL, VITE_SUPABASE_URL, and SUPABASE_SECRET_KEY.',
  );

  test.afterEach(async () => {
    for (const userId of createdUserIds) {
      await deleteUser(userId);
    }
    createdUserIds.clear();
  });

  test('syncs a capture and attachment into another signed-in context', async ({
    browser,
  }) => {
    const email = `holdfast-sync-${Date.now()}@example.com`;
    const firstLink = await createMagicLink(email);
    createdUserIds.add(firstLink.userId);

    const firstContext = await browser.newContext();
    const secondContext = await browser.newContext({ acceptDownloads: true });
    const firstPage = await firstContext.newPage();
    const secondPage = await secondContext.newPage();

    try {
      await consumeMagicLink(firstLink.actionLink, firstPage);
      await openSignedInSettings(firstPage);
      await firstPage.goto('/inbox', { waitUntil: 'networkidle' });
      await expect(
        firstPage.getByRole('heading', { name: 'Inbox' }),
      ).toBeVisible();

      const secondLink = await createMagicLink(email);
      createdUserIds.add(secondLink.userId);
      expect(firstLink.userId).toBe(secondLink.userId);

      await consumeMagicLink(secondLink.actionLink, secondPage);
      await openSignedInSettings(secondPage);
      await secondPage.goto('/inbox', { waitUntil: 'networkidle' });
      await expect(
        secondPage.getByRole('heading', { name: 'Inbox' }),
      ).toBeVisible();

      const title = `Hosted sync capture ${Date.now()}`;
      const attachmentName = 'holdfast-sync-proof.txt';

      await firstPage.getByRole('button', { name: 'Add' }).click();
      await firstPage
        .getByPlaceholder('What do you need to keep?')
        .fill(title);
      await firstPage.getByRole('button', { name: 'Save to Inbox' }).click();
      await expect(firstPage.getByText(title, { exact: true })).toBeVisible();

      const remoteItem = await waitForRemoteItemByTitle(firstLink.userId, title);

      const firstCard = firstPage
        .locator('article.item-card')
        .filter({ hasText: title })
        .first();
      await firstCard.getByRole('button', { name: 'Details' }).click();
      await expect(
        firstPage.getByRole('heading', { name: 'Details' }),
      ).toBeVisible();

      await firstPage.locator('.file-button input[type="file"]').setInputFiles({
        mimeType: 'text/plain',
        name: attachmentName,
        buffer: Buffer.from('Holdfast hosted sync proof\n'),
      });
      await expect(firstPage.getByText(attachmentName, { exact: true })).toBeVisible();

      await waitForRemoteAttachment(firstLink.userId, remoteItem.id, attachmentName);

      await reloadUntilTextVisible(secondPage, title);
      const secondCard = secondPage
        .locator('article.item-card')
        .filter({ hasText: title })
        .first();
      await secondCard.getByRole('button', { name: 'Details' }).click();
      await expect(secondPage.getByText(attachmentName, { exact: true })).toBeVisible();

      const [download] = await Promise.all([
        secondPage.waitForEvent('download'),
        secondPage.getByRole('button', { name: 'Download' }).click(),
      ]);

      expect(download.suggestedFilename()).toBe(attachmentName);
      await expect.poll(async () => download.failure()).toBeNull();
    } finally {
      await firstContext.close();
      await secondContext.close();
    }
  });
});
