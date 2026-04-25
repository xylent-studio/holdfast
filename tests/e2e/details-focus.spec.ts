import { expect, test } from '@playwright/test';

async function updateItemTimestampInIndexedDb(
  page: import('@playwright/test').Page,
  title: string,
) {
  await page.evaluate(async (itemTitle) => {
    await new Promise<void>((resolve, reject) => {
      const openRequest = indexedDB.open('holdfast');

      openRequest.onerror = () => reject(openRequest.error);
      openRequest.onsuccess = () => {
        const database = openRequest.result;
        const transaction = database.transaction('items', 'readwrite');
        const store = transaction.objectStore('items');
        const getAllRequest = store.getAll();

        getAllRequest.onerror = () => reject(getAllRequest.error);
        getAllRequest.onsuccess = () => {
          const matchingItem = getAllRequest.result.find(
            (item: { title?: string }) => item.title === itemTitle,
          );

          if (!matchingItem) {
            reject(new Error(`Could not find item "${itemTitle}" in IndexedDB.`));
            return;
          }

          store.put({
            ...matchingItem,
            remoteRevision: `background-${Date.now()}`,
            syncState: 'synced',
            updatedAt: new Date().toISOString(),
          });
        };

        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => {
          database.close();
          reject(transaction.error);
        };
      };
    });
  }, title);
}

test('keeps item details typing focused during background item refresh', async ({
  page,
}) => {
  await page.goto('/inbox');
  await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible();

  const title = `Details focus ${Date.now()}`;
  await page.getByRole('button', { name: 'Add' }).click();
  await page.getByPlaceholder('What do you need to keep?').fill(title);
  await page.getByRole('button', { name: 'Save to Inbox' }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();

  await page
    .locator('article.item-card')
    .filter({ hasText: title })
    .first()
    .getByRole('button', { name: 'Details' })
    .click();
  await expect(page.getByRole('dialog', { name: 'Item details' })).toBeVisible();

  const notes = page.getByLabel('Notes');
  await notes.fill('draft before background refresh');
  await notes.focus();
  await expect(notes).toBeFocused();

  await updateItemTimestampInIndexedDb(page, title);

  await expect(notes).toBeFocused();
  await expect(notes).toHaveValue('draft before background refresh');
});
