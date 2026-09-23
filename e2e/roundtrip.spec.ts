import {test,expect} from '@playwright/test';
import path from 'node:path';

test('intake form creates a request ZIP and result JSON opens as a report',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'鑑定をはじめる'}).click();
 await page.locator('input[autocomplete="name"]').fill('試験 花子');
 await page.locator('input[type="date"]').fill('2000-01-02');
 const download=page.waitForEvent('download');
 await page.getByRole('button',{name:/依頼ZIPをダウンロード/}).click();
 expect((await download).suggestedFilename()).toMatch(/shinra-bansho-request-\d{4}-\d{2}-\d{2}\.zip/);
 await page.locator('#result-file').setInputFiles(path.resolve('fixtures/result.json'));
 await expect(page.locator('.report-cover h1')).toHaveText('知性といたわりで、世界をつなぐ人');
 await expect(page.getByRole('heading',{name:'占術別の読み'})).toBeVisible();
 const shareImage=page.waitForEvent('download');
 await page.getByRole('button',{name:'シェア画像を保存'}).click();
 expect((await shareImage).suggestedFilename()).toBe('shinra-bansho-share.png');
 await page.emulateMedia({media:'print'});
 await expect(page.locator('.report-toolbar')).toBeHidden();
});
