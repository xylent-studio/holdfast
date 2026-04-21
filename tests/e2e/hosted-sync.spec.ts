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
  waitForRemoteItemTitle,
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

  test('replays an offline capture into another signed-in context when the network returns', async ({
    browser,
  }) => {
    const email = `holdfast-offline-${Date.now()}@example.com`;
    const firstLink = await createMagicLink(email);
    createdUserIds.add(firstLink.userId);

    const firstContext = await browser.newContext();
    const secondContext = await browser.newContext();
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

      const title = `Hosted offline replay ${Date.now()}`;

      await firstContext.setOffline(true);
      await firstPage.getByRole('button', { name: 'Add' }).click();
      await firstPage
        .getByPlaceholder('What do you need to keep?')
        .fill(title);
      await firstPage.getByRole('button', { name: 'Save to Inbox' }).click();
      await expect(firstPage.getByText(title, { exact: true })).toBeVisible();

      await firstPage.goto('/settings', { waitUntil: 'domcontentloaded' });
      await expect(firstPage.getByRole('heading', { name: 'Account' })).toBeVisible();
      await expect(firstPage.getByText('Saved offline', { exact: true })).toBeVisible();

      await firstContext.setOffline(false);

      await waitForRemoteItemByTitle(firstLink.userId, title, 30_000);

      await firstPage.goto('/settings', { waitUntil: 'networkidle' });
      await reloadUntilTextVisible(firstPage, 'Up to date');

      await secondPage.goto('/inbox', { waitUntil: 'networkidle' });
      await reloadUntilTextVisible(secondPage, title);
    } finally {
      await firstContext.close();
      await secondContext.close();
    }
  });

  test('keeps one item identity clean when a later offline edit catches up over an earlier online edit', async ({
    browser,
  }) => {
    const email = `holdfast-conflict-${Date.now()}@example.com`;
    const firstLink = await createMagicLink(email);
    createdUserIds.add(firstLink.userId);

    const firstContext = await browser.newContext();
    const secondContext = await browser.newContext();
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

      const baseTitle = `Hosted conflict item ${Date.now()}`;
      const onlineTitle = `${baseTitle} online`;
      const offlineTitle = `${baseTitle} offline`;

      await firstPage.getByRole('button', { name: 'Add' }).click();
      await firstPage
        .getByPlaceholder('What do you need to keep?')
        .fill(baseTitle);
      await firstPage.getByRole('button', { name: 'Save to Inbox' }).click();
      await expect(firstPage.getByText(baseTitle, { exact: true })).toBeVisible();

      const remoteItem = await waitForRemoteItemByTitle(firstLink.userId, baseTitle);
      await reloadUntilTextVisible(secondPage, baseTitle);

      const firstCard = firstPage
        .locator('article.item-card')
        .filter({ hasText: baseTitle })
        .first();
      await firstCard.getByRole('button', { name: 'Details' }).click();
      await firstPage.getByLabel('Title').fill(onlineTitle);
      await firstPage.getByRole('button', { name: 'Save' }).click();
      await expect(firstPage.getByText(onlineTitle, { exact: true })).toBeVisible();
      await waitForRemoteItemTitle(firstLink.userId, remoteItem.id, onlineTitle);

      await secondPage.goto('/inbox', { waitUntil: 'networkidle' });
      await reloadUntilTextVisible(secondPage, onlineTitle);
      await secondContext.setOffline(true);
      await secondPage.waitForTimeout(1_000);

      const secondCard = secondPage
        .locator('article.item-card')
        .filter({ hasText: onlineTitle })
        .first();
      await secondCard.getByRole('button', { name: 'Details' }).click();
      await secondPage.getByLabel('Title').fill(offlineTitle);
      await secondPage.getByRole('button', { name: 'Save' }).click();
      await expect(secondPage.getByText(offlineTitle, { exact: true })).toBeVisible();

      await secondPage.goto('/settings', { waitUntil: 'domcontentloaded' });
      await expect(secondPage.getByRole('heading', { name: 'Account' })).toBeVisible();
      await expect(secondPage.getByText('Saved offline', { exact: true })).toBeVisible();

      await secondContext.setOffline(false);
      await waitForRemoteItemTitle(firstLink.userId, remoteItem.id, offlineTitle, 30_000);

      await firstPage.goto('/inbox', { waitUntil: 'networkidle' });
      await reloadUntilTextVisible(firstPage, offlineTitle);
      await expect(
        firstPage
          .locator('article.item-card')
          .filter({ hasText: offlineTitle }),
      ).toHaveCount(1);
    } finally {
      await firstContext.close();
      await secondContext.close();
    }
  });
});
