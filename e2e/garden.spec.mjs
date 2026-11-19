import { expect, test } from '@playwright/test';
import { levelsById, solutions } from '../tests/solutions.mjs';

const select=(page,id)=>page.getByRole('combobox',{name:'Lesson',exact:true}).selectOption(id);
const editor=page=>page.getByRole('textbox',{name:'C# code'});
const play=page=>page.getByRole('button',{name:'Run Sequence'});
const reset=page=>page.getByRole('button',{name:'Reset Garden'});
const status=page=>page.locator('.status-strip');
const programError=page=>page.locator('.program-error');
const scene=page=>page.getByRole('region',{name:'Garden view'});
const workspace=page=>page.getByRole('region',{name:'Flight workspace'});
const displayControls=page=>page.getByRole('group',{name:'Display controls'});

async function ready(page) {
  await expect(scene(page)).toHaveAttribute('data-graphics','ready',{timeout:15000});
}
async function useFlatMap(page) {
  await page.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(kind,...args){
      return String(kind).includes('webgl') ? null : original.call(this,kind,...args);
    };
  });
}
async function gallery(page,testInfo,label) {
  await page.evaluate(()=>scrollTo(0,0));
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.screenshot({path:testInfo.outputPath(label+'.png')});
}
test.describe('Retina rendering',()=>{
  test.use({deviceScaleFactor:2,viewport:{width:1512,height:900}});
  test('The garden renders at screen resolution and stays sharp after resizing',async({page},testInfo)=>{
    await page.route('**/favicon.ico',route=>route.fulfill({status:204,body:''}));
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{
      if(message.type()==='error' || /INVALID_(?:FRAMEBUFFER|OPERATION)|Error compiling/.test(message.text())) errors.push(message.text());
    });
    await page.addInitScript(()=>{
      window.multisampleCounts=[];
      const storage=WebGL2RenderingContext.prototype.renderbufferStorageMultisample;
      WebGL2RenderingContext.prototype.renderbufferStorageMultisample=function(target,samples,...args){
        window.multisampleCounts.push(samples);
        return storage.call(this,target,samples,...args);
      };
    });
    await page.goto('/');
    await ready(page);
    const canvas=page.locator('.garden-canvas');
    const resolution=()=>canvas.evaluate(node=>({
      screenRatio:devicePixelRatio,
      width:node.width,height:node.height,
      displayWidth:node.clientWidth,displayHeight:node.clientHeight,
    }));
    const initial=await resolution();
    console.log('Retina garden resolution:',initial);
    expect(initial.screenRatio).toBe(2);
    expect(initial.width/initial.displayWidth).toBeCloseTo(2,2);
    expect(initial.height/initial.displayHeight).toBeCloseTo(2,2);
    expect(await page.evaluate(()=>window.multisampleCounts)).toContain(4);
    await gallery(page,testInfo,'retina-garden-1512x900');
    await page.setViewportSize({width:1280,height:800});
    await expect.poll(async()=>{
      const size=await resolution();
      return Math.abs(size.width-size.displayWidth*2);
    }).toBeLessThanOrEqual(1);
    await editor(page).fill(solutions['first-harvest']);
    await play(page).click();
    await expect(status(page)).toHaveAttribute('data-outcome','success');
    await expect.poll(()=>canvas.getAttribute('data-fps')).not.toBeNull();
    console.log('Retina garden FPS:',await canvas.getAttribute('data-fps'));
    const client=await page.context().newCDPSession(page);
    await client.send('Emulation.setDeviceMetricsOverride',{
      width:1280,height:800,deviceScaleFactor:3,mobile:false,
    });
    await expect.poll(async()=>{
      const size=await resolution();
      return {density:size.screenRatio,scale:Math.round(size.width/size.displayWidth*100)/100};
    }).toEqual({density:3,scale:2});
    await client.send('Emulation.setDeviceMetricsOverride',{
      width:1280,height:800,deviceScaleFactor:1,mobile:false,
    });
    await expect.poll(async()=>{
      const size=await resolution();
      return {density:size.screenRatio,scale:Math.round(size.width/size.displayWidth*100)/100};
    }).toEqual({density:1,scale:1});
    await client.detach();
    expect(errors).toEqual([]);
  });
});
test('Production assets stay on loopback; Level 1 and 2 can be taught from a real WebGL frame',async({page,context,baseURL},testInfo)=>{
  const outside=[], errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/*',route=>{
    if (new URL(route.request().url()).origin === new URL(baseURL).origin) return route.continue();
    outside.push(route.request().url()); return route.abort();
  });
  const model=page.waitForResponse(response=>response.url().endsWith('/assets/ziki.glb'));
  await page.goto('/');
  expect((await model).ok()).toBeTruthy();
  await ready(page);
  const startup=await page.evaluate(()=>performance.now());
  expect(startup).toBeLessThan(5000);
  await expect(editor(page)).toHaveValue('Move(1);');
  await expect(page.locator('.hud, [data-testid=position], [data-testid=battery]')).toHaveCount(0);
  await expect(page).toHaveTitle('Ziki');
  await expect(page.getByRole('banner')).toHaveCount(0);
  const [gardenBox, workBox, codeBox, runBox, controlsBox, focusBox] = await Promise.all([
    page.locator('.garden-canvas').boundingBox(), workspace(page).boundingBox(),
    editor(page).boundingBox(), play(page).boundingBox(), displayControls(page).boundingBox(),
    scene(page).locator('.scene-focus').boundingBox(),
  ]);
  expect(gardenBox).toEqual({x:0,y:0,width:1280,height:720});
  expect(controlsBox.x).toBeGreaterThan(0);
  expect(controlsBox.x).toBeLessThan(32);
  expect(controlsBox.y+controlsBox.height).toBeGreaterThan(720-32);
  expect(controlsBox.y+controlsBox.height).toBeLessThan(720);
  expect(focusBox.x+focusBox.width).toBeLessThan(workBox.x);
  expect(focusBox.y+focusBox.height).toBeLessThan(controlsBox.y);
  expect(workBox.x).toBeGreaterThan(gardenBox.x + gardenBox.width / 2);
  expect(workBox.x+workBox.width).toBeLessThan(gardenBox.x+gardenBox.width);
  expect(workBox.y).toBeGreaterThan(gardenBox.y);
  expect(workBox.y+workBox.height).toBeLessThanOrEqual(gardenBox.y+gardenBox.height);
  expect(codeBox.width).toBeGreaterThan(350);
  expect(codeBox.y).toBeGreaterThan(runBox.y);
  expect(runBox.y + runBox.height).toBeLessThan(720);
  const lessonPicker = page.getByRole('combobox',{name:'Lesson',exact:true});
  await expect(lessonPicker.locator('option')).toHaveCount(13);
  const pickerBox = await lessonPicker.boundingBox();
  expect(pickerBox.y).toBeGreaterThan(codeBox.y + codeBox.height);
  await expect(page.getByRole('heading',{name:levelsById['first-harvest'].title})).toHaveCount(0);
  await expect(page.getByText(levelsById['first-harvest'].objective,{exact:true})).toHaveCount(0);
  await expect(scene(page).locator('.world-label')).toHaveCount(0);
  await expect(scene(page).getByLabel('North increases y. East increases x.')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Show hint'})).toHaveCount(0);
  for (const label of ['Flight log','Lesson reference','Display settings']) {
    await expect(page.getByText(label,{exact:true})).toHaveCount(0);
  }
  await gallery(page,testInfo,'01-first-harvest-1280x720');
  await page.screenshot({path:testInfo.outputPath('01-instructor-layout.png'),fullPage:true});
  await page.setViewportSize({width:1512,height:900});
  await gallery(page,testInfo,'01-closer-garden-1512x900');
  await page.setViewportSize({width:1280,height:720});
  await play(page).click();
  await expect(status(page)).toContainText('No rose to harvest');
  await expect(editor(page)).toBeEditable();
  await editor(page).fill(solutions['first-harvest']);
  await editor(page).press('Control+Enter');
  await expect(status(page)).toContainText('Rose harvested');
  const worldCanvas=page.locator('.garden-canvas');
  await expect.poll(()=>worldCanvas.getAttribute('data-fps')).not.toBeNull();
  const fps=Number(await worldCanvas.getAttribute('data-fps'));
  const gpu=await worldCanvas.evaluate(canvas=>{
    const gl=canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    const ext=gl?.getExtension('WEBGL_debug_renderer_info');
    return ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
  });
  console.log(JSON.stringify({ startupMs:Math.round(startup), fps, gpu }));
  await page.getByRole('button',{name:'Next level'}).click();
  await expect(lessonPicker).toHaveValue('fly-west');
  await expect(page.locator('.hud, [data-testid=position], [data-testid=battery]')).toHaveCount(0);
  await editor(page).fill(solutions['fly-west']);
  await play(page).click();
  await expect(status(page)).toContainText('Rose harvested');
  await page.getByRole('button',{name:'Next level'}).click();
  await expect(lessonPicker.locator('option:checked')).toHaveText('03 · Follow the Rose Position');
  await select(page,'battery-range');
  await ready(page);
  await expect(workspace(page).getByRole('combobox')).toHaveCount(1);
  await expect(page.locator('.hud, [data-testid=battery], [data-testid=percentage]')).toHaveCount(0);
  const consoleBox=await workspace(page).boundingBox();
  for(const rose of await page.locator('[data-marker^=rose-]').all()) {
    const box=await rose.boundingBox();
    expect(box.x).toBeGreaterThan(gardenBox.x);
    expect(box.x+box.width).toBeLessThan(consoleBox.x);
  }
  await gallery(page,testInfo,'05-battery-1280x720');
  expect(errors).toEqual([]);
  expect(outside).toEqual([]);
});
test('The editor indents with Tab, preserves undo, and grows to show the full program',async({page},testInfo)=>{
  await page.goto('/');
  await ready(page);
  const code=editor(page);
  expect((await code.boundingBox()).height).toBeGreaterThan(350);
  const initial='if (true)\n{\nMove(1);\n}';
  await code.fill(initial);
  await code.evaluate(input=>input.setSelectionRange(input.value.indexOf('Move'),input.value.indexOf('Move')));
  await code.press('Tab');
  await expect(code).toBeFocused();
  await expect(code).toHaveValue('if (true)\n{\n    Move(1);\n}');
  await code.press('ControlOrMeta+z');
  await expect(code).toHaveValue(initial);

  const block='Move(1);\nMove(2);\n';
  await code.fill(block);
  await code.selectText();
  await code.press('Tab');
  await expect(code).toHaveValue('    Move(1);\n    Move(2);\n');
  await code.press('Shift+Tab');
  await expect(code).toHaveValue(block);
  await code.press('Escape');
  await code.press('Tab');
  await expect(page.getByRole('combobox',{name:'Lesson',exact:true})).toBeFocused();

  const longProgram='Move(0);\n'.repeat(45)+'Move(3);';
  await code.fill(longProgram);
  const size=await code.evaluate(input=>({height:input.clientHeight,content:input.scrollHeight}));
  expect(size.height).toBeGreaterThan(1200);
  expect(size.content).toBeLessThanOrEqual(size.height);
  await code.press('Control+End');
  await code.press('Enter');
  await expect.poll(()=>code.evaluate(input=>input.scrollTop)).toBe(0);
  expect(await code.evaluate(input=>input.scrollHeight<=input.clientHeight)).toBe(true);
  await page.evaluate(()=>scrollTo(0,400));
  const desktopScroll=await page.evaluate(()=>scrollY);
  expect(desktopScroll).toBeGreaterThan(0);
  const editorTop=(await code.boundingBox()).y;
  expect(await scene(page).boundingBox()).toEqual({x:0,y:0,width:1280,height:720});
  await page.keyboard.press('Control+Enter');
  await expect(status(page)).toHaveAttribute('data-outcome','running');
  // Chrome anchors the visible code when the new status row moves the editor down.
  expect((await code.boundingBox()).y).toBe(editorTop);
  await page.setViewportSize({width:390,height:844});
  expect(await code.evaluate(input=>input.scrollHeight<=input.clientHeight)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const [mobileGarden,mobileWork]=await Promise.all([
    scene(page).boundingBox(),workspace(page).boundingBox(),
  ]);
  expect(mobileGarden.x).toBe(0);
  expect(mobileGarden.width).toBe(390);
  expect(mobileWork.y).toBeGreaterThanOrEqual(mobileGarden.y+mobileGarden.height);
  await page.evaluate(()=>scrollTo(0,800));
  expect((await scene(page).boundingBox()).y).toBeLessThan(0);
  await page.keyboard.press('Control+Enter');
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
  await page.setViewportSize({width:1280,height:720});
  await select(page,'shorter-route');
  await ready(page);
  await expect(code).toHaveValue(levelsById['shorter-route'].starter);
  expect(await code.evaluate(input=>input.scrollHeight<=input.clientHeight)).toBe(true);
  expect(await code.evaluate(input=>input.scrollWidth<=input.clientWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('expanded-code-editor.png'),fullPage:true});
  await code.blur();
  await page.setViewportSize({width:1920,height:1080});
  await page.evaluate(()=>scrollTo(0,0));
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const heading=page.getByRole('heading',{name:'Ziki',exact:true});
  await expect(heading).toHaveClass('sr-only');
  expect(await scene(page).boundingBox()).toEqual({x:0,y:0,width:1920,height:1080});
  await page.screenshot({path:testInfo.outputPath('side-by-side-1920x1080.png')});
});
test('Program error explains a misspelled command above the editor and can be dismissed by keyboard',async({page},testInfo)=>{
  await page.goto('/');
  await select(page,'fly-west');
  await ready(page);
  const input=editor(page);
  const card=programError(page);
  const mistake='Movvve(-1);';
  await input.fill(mistake);
  await input.press('Control+Enter');
  await expect(card.getByRole('heading',{name:'Code error'})).toBeVisible();
  await expect(card).toContainText('Line 1, column 1');
  await expect(card).toContainText('“Movvve” is not an available command');
  await expect(card).toContainText('Move.');
  await expect(page.getByRole('alert')).toHaveCount(1);
  await expect(page.getByRole('alert')).toContainText('Line 1, column 1');
  await expect(page.locator('.code-error')).toHaveText('1');
  await expect(input).toHaveAttribute('aria-invalid','true');
  await expect(input).toBeFocused();
  await expect(status(page)).toBeEmpty();
  const panel=page.getByRole('region',{name:'C# program'});
  const [cardBox, panelBox, runBox]=await Promise.all([card.boundingBox(),panel.boundingBox(),play(page).boundingBox()]);
  expect(cardBox.y).toBeGreaterThanOrEqual(runBox.y+runBox.height);
  expect(cardBox.y+cardBox.height).toBeLessThanOrEqual(panelBox.y);
  await page.screenshot({path:testInfo.outputPath('program-error-desktop.png')});

  const close=card.getByRole('button',{name:'Dismiss error'});
  await close.focus();
  await close.press('Escape');
  await expect(card).toHaveCount(0);
  await expect(page.locator('.code-error')).toHaveCount(0);
  await expect(input).toBeFocused();
  await expect(input).toHaveValue(mistake);

  await displayControls(page).getByRole('button',{name:'Fullscreen',exact:true}).click();
  await input.press('Control+Enter');
  await expect(page.getByRole('alert')).toContainText('Movvve');
  await expect(card).toBeInViewport();
  await expect(page.locator('.code-error')).toBeInViewport();
  await input.fill('Move(-1);');
  await expect(card).toHaveCount(0);
  await expect(input).toHaveAttribute('aria-invalid','false');
  await expect(page.locator('.code-error')).toHaveCount(0);
  await displayControls(page).getByRole('button',{name:'Exit fullscreen'}).click();
});

test('Program error follows the last valid flight event and resets with the run',async({page})=>{
  await useFlatMap(page);
  await page.goto('/');
  await expect(scene(page)).toHaveAttribute('data-graphics','unavailable');
  const card=programError(page);
  const activeTile=page.locator('.map-active > small');
  const input=editor(page);
  await input.fill('Move(1);\nint divisor = 0;\nConsole.WriteLine(4 / divisor);\nMove(3);');
  await play(page).click();
  await expect(status(page)).toHaveAttribute('data-outcome','running');
  await expect(card).toHaveCount(0);
  await expect(card.getByRole('heading',{name:'Runtime error'})).toBeVisible();
  await expect(card).toContainText('The divisor is 0');
  await expect(page.locator('.code-error')).toHaveText('3');
  await expect(status(page)).toBeEmpty();
  await expect(activeTile).toHaveText('1,0');
  await card.getByRole('button',{name:'Dismiss error'}).click();
  await expect(activeTile).toHaveText('1,0');
  await expect(page.locator('.code-error')).toHaveCount(0);

  await select(page,'fly-west');
  await input.fill('Move(-1);\nMove(-5);');
  await play(page).click();
  await expect(card.getByRole('heading',{name:'Flight stopped'})).toBeVisible();
  await expect(card).toContainText('Tile (-1, 0) is outside the garden');
  await expect(page.locator('.code-blocked')).toHaveText('2');
  await expect(activeTile).toHaveText('0,0');
  await expect(page.locator('.map-drone')).toHaveCSS('--sadness','1');
  await expect(card).toHaveCount(1);
  await expect(status(page)).toBeEmpty();

  await play(page).click();
  await expect(status(page)).toHaveAttribute('data-outcome','running');
  await reset(page).click();
  await expect(activeTile).toHaveText('5,0');
  await expect(card).toHaveCount(0);
  await play(page).click();
  await expect(status(page)).toHaveAttribute('data-outcome','running');
  await select(page,'battery-range');
  await input.fill('Movvve(-1);');
  await play(page).click();
  await expect(card.getByRole('heading',{name:'Code error'})).toBeVisible();
  await select(page,'battery-last-meter');
  await expect(card).toHaveCount(0);
  await expect(page.locator('.code-error, .code-blocked')).toHaveCount(0);
  await select(page,'battery-range');
  await play(page).click();
  await expect(card).toBeVisible();
  await page.getByRole('button',{name:'Restore starter'}).click();
  await expect(card).toHaveCount(0);
  await expect(input).toHaveValue(levelsById['battery-range'].starter);
  await expect(status(page)).toHaveAttribute('data-outcome','ready');
});

test('Program error stays with a deep code line on mobile and Go to line works on a short screen',async({page},testInfo)=>{
  await useFlatMap(page);
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce',forcedColors:'active'});
  await page.goto('/');
  await select(page,'rose-position');
  const input=editor(page);
  const card=programError(page);
  const row=page.locator('.code-error');
  const declaration=levelsById['rose-position'].starter.split('\n')[0];
  const source=declaration+'\n'+'// Student note\n'.repeat(45)+'    Move(4.7);';
  await input.fill(source);
  await input.press('Control+Enter');
  await expect(card).toContainText('Line 47, column 10');
  await expect(row).toHaveText('47');
  await expect(card).toBeInViewport({ratio:1});
  await expect(row).toBeInViewport({ratio:1});
  const [cardBox, rowBox]=await Promise.all([card.boundingBox(),row.boundingBox()]);
  expect(cardBox.y+cardBox.height).toBeLessThan(rowBox.y);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({path:testInfo.outputPath('program-error-mobile-forced-colors.png')});

  await page.setViewportSize({width:650,height:300});
  await input.press('Control+Enter');
  const go=card.getByRole('button',{name:'Go to line'});
  await expect(go).toBeInViewport({ratio:1});
  await go.click();
  await expect(input).toBeFocused();
  await expect(row).toBeInViewport({ratio:1});
  await expect.poll(()=>input.evaluate(node=>[node.selectionStart,node.selectionEnd])).toEqual([
    source.indexOf('4.7'),source.indexOf('4.7'),
  ]);
  await expect(input).toHaveValue(source);

  const wideLine='Move('+'\t'.repeat(26)+'4.7);';
  await input.fill(wideLine);
  await input.evaluate(node=>{ node.setSelectionRange(0,0); node.scrollLeft=0; });
  await input.press('Control+Enter');
  await go.click();
  await expect.poll(()=>input.evaluate(node=>node.selectionStart)).toBe(wideLine.indexOf('4.7'));
  await expect.poll(()=>input.evaluate(node=>node.scrollLeft)).toBeGreaterThan(0);
});

test('The variable lesson supplies a rose position and keeps the student’s draft',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await select(page,'rose-position');
  await ready(page);
  const starter = 'int rosePosition = 2;\nMove(1);';
  await expect(editor(page)).toHaveValue(starter);
  await editor(page).fill(solutions['rose-position']);
  await play(page).click();
  await expect(status(page)).toHaveAttribute('data-outcome','success');

  await select(page,'fly-west');
  await select(page,'rose-position');
  await expect(editor(page)).toHaveValue(solutions['rose-position']);
  await page.getByRole('button',{name:'Restore starter'}).click();
  await expect(editor(page)).toHaveValue(starter);
});
test('East and west movement calculations are separate lessons with independent drafts',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await select(page,'rose-position');
  await ready(page);
  await editor(page).fill(solutions['rose-position']);
  await play(page).click();
  const selectors=page.getByRole('group',{name:'Lesson navigation'});
  const lesson=selectors.getByRole('combobox',{name:'Lesson',exact:true});
  const next=selectors.getByRole('button',{name:'Next level'});
  await expect(next).toBeVisible();
  for(const width of [1280,320]) {
    await page.setViewportSize({width,height:720});
    const [lessonBox,nextBox]=await Promise.all([lesson.boundingBox(),next.boundingBox()]);
    expect(nextBox.x-lessonBox.x-lessonBox.width).toBeCloseTo(8);
    expect(nextBox.y).toBeCloseTo(lessonBox.y);
    expect(nextBox.x+nextBox.width).toBeLessThan(width);
  }
  await next.click();
  await expect(lesson.locator('option:checked')).toHaveText('04 · Calculate the Move');
  await page.setViewportSize({width:1280,height:720});

  const east = 'int zikiPosition = 1;\nint rosePosition = 4;\n';
  const west = 'int zikiPosition = 3;\nint rosePosition = 1;\n';
  await expect(editor(page)).toHaveValue(east+'Move(rosePosition);');
  await play(page).click();
  await expect(status(page)).toHaveAttribute('data-outcome','retry');

  await editor(page).fill(solutions['movement-offset']);
  await play(page).click();
  await expect(status(page)).toHaveAttribute('data-outcome','success');

  await next.click();
  await expect(lesson.locator('option:checked')).toHaveText('05 · Calculate the Move West');
  await expect(lesson.locator('option[value="movement-offset"]')).toHaveText('04 · Calculate the Move ✓');
  await expect(editor(page)).toHaveValue(west+'Move(rosePosition);');
  await editor(page).fill(solutions['movement-offset-west']);
  await play(page).click();
  await expect(status(page)).toHaveAttribute('data-outcome','success');
  await expect(lesson.locator('option:checked')).toHaveText('05 · Calculate the Move West ✓');
  await select(page,'movement-offset');
  await expect(editor(page)).toHaveValue(solutions['movement-offset']);
});
test('The victory celebration draws once on success and clears on reset',async({page},testInfo)=>{
  await page.goto('/');
  await ready(page);
  const party=page.locator('.victory-celebration');
  await play(page).click();
  await expect(status(page)).toHaveAttribute('data-outcome','retry');
  await expect(party).toHaveCount(0);
  await editor(page).fill(solutions['first-harvest']);
  await play(page).click();
  await expect(status(page)).toHaveAttribute('data-outcome','success');
  await expect(party).toHaveCount(1);
  await expect.poll(()=>party.evaluate(canvas=>{
    return canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.some((value,index)=>index%4===3 && value>0);
  })).toBe(true);
  await page.waitForTimeout(700);
  await gallery(page,testInfo,'victory-celebration');
  await reset(page).click();
  await expect(party).toHaveCount(0);
});
test('Dabi cheers respect the saved sound preference, mute, reset, and lesson changes',async({page})=>{
  await page.addInitScript(()=>{
    window.cheerVoices=[];
    const start=AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start=function(...args){
      const voice={duration:this.buffer?.duration,ended:false};
      window.cheerVoices.push(voice);
      this.addEventListener('ended',()=>{voice.ended=true;});
      return start.apply(this,args);
    };
  });
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await ready(page);
  await editor(page).fill(solutions['first-harvest']);
  await play(page).click();
  await expect(status(page)).toHaveAttribute('data-outcome','success');
  expect(await page.evaluate(()=>window.cheerVoices)).toEqual([]);

  const applause=page.waitForResponse(response=>response.url().endsWith('/assets/audio/applause-01.wav'));
  await page.getByRole('button',{name:'Sound off'}).click();
  expect((await applause).ok()).toBe(true);
  await page.reload();
  await ready(page);
  await expect(page.getByRole('button',{name:'Sound on'})).toHaveAttribute('aria-pressed','true');
  await editor(page).fill('Move(1);');
  await play(page).click();
  await expect(status(page)).toHaveAttribute('data-outcome','retry');
  expect(await page.evaluate(()=>window.cheerVoices)).toEqual([]);
  await editor(page).fill(solutions['first-harvest']);
  await play(page).click();
  await expect.poll(()=>page.evaluate(()=>window.cheerVoices.length)).toBe(1);
  expect(await page.evaluate(()=>window.cheerVoices[0].duration)).toBeCloseTo(5.5,1);
  await page.getByRole('button',{name:'Sound on'}).click();
  await expect.poll(()=>page.evaluate(()=>window.cheerVoices[0].ended)).toBe(true);

  await page.getByRole('button',{name:'Sound off'}).click();
  await play(page).click();
  await expect.poll(()=>page.evaluate(()=>window.cheerVoices.length)).toBe(2);
  await reset(page).click();
  await expect.poll(()=>page.evaluate(()=>window.cheerVoices[1].ended)).toBe(true);
  await play(page).click();
  await expect.poll(()=>page.evaluate(()=>window.cheerVoices.length)).toBe(3);
  await page.getByRole('button',{name:'Next level'}).click();
  await expect.poll(()=>page.evaluate(()=>window.cheerVoices[2].ended)).toBe(true);
  await page.getByRole('button',{name:'Sound on'}).click();
  await page.reload();
  await expect(page.getByRole('button',{name:'Sound off'})).toHaveAttribute('aria-pressed','false');
});
test('The two battery-range lessons and the single rounding lesson report the expected results',async({page},testInfo)=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await select(page,'battery-range');
  await ready(page);
  const firstInputs='int batteryRange = 4;\nint rose1Position = 4;\nint rose2Position = 9;\nint zikiPosition = 1;';
  const secondInputs='int batteryRange = 3;\nint rose1Position = 8;\nint rose2Position = 5;\nint zikiPosition = 2;';
  await expect(editor(page)).toHaveValue(firstInputs);
  await expect(page.locator('[data-marker^=rose-]')).toHaveCount(2);
  await play(page).click();
  await expect(status(page)).toHaveAttribute('data-outcome','retry');
  await editor(page).fill(solutions['battery-range']);
  await play(page).click();
  await expect(status(page)).toHaveAttribute('data-outcome','success');
  await expect(page.locator('[data-marker=rose-A]')).toBeHidden();
  await expect(page.locator('[data-marker=rose-B]')).toBeVisible();
  await page.getByRole('button',{name:'Next level'}).click();
  await ready(page);
  await expect(page.getByRole('combobox',{name:'Lesson',exact:true})).toHaveValue('battery-last-meter');
  await expect(editor(page)).toHaveValue(secondInputs);
  await editor(page).fill(solutions['battery-last-meter']);
  await play(page).click();
  await expect(status(page)).toHaveAttribute('data-outcome','success');
  await expect(page.locator('[data-marker=rose-B]')).toBeHidden();
  await editor(page).fill(secondInputs+'\nMove(rose1Position - zikiPosition);');
  await play(page).click();
  await expect(programError(page)).toContainText('Battery range ran out');
  await expect(programError(page)).toContainText('Line 5, column 1');
  await expect(page.locator('.code-blocked')).toHaveText('5');
  await expect(status(page)).toBeEmpty();
  await expect(page.locator('[data-marker=rose-B]')).toBeVisible();
  await reset(page).click();
  await expect(programError(page)).toHaveCount(0);
  await expect(page.locator('.code-blocked')).toHaveCount(0);
  await page.getByRole('button',{name:'Restore starter'}).click();
  await expect(editor(page)).toHaveValue(secondInputs);
  await gallery(page,testInfo,'07-battery-last-meter-1280x720');
  await select(page,'battery-display');
  await ready(page);
  await expect(workspace(page).getByRole('combobox')).toHaveCount(1);
  await play(page).click();
  await expect(status(page)).toContainText('nearest whole percentage');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await editor(page).fill(solutions['battery-display']);
  await play(page).click();
  await expect(page.locator('.code-active')).toHaveText('1');
  await gallery(page,testInfo,'08-rounding-active-line');
  await expect(status(page)).toContainText('calibrated: 98%');
  await reset(page).click();
});
test('GPS pin stays visible beside the console and the rounded flight succeeds',async({page},testInfo)=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await select(page,'gps-rose');
  await ready(page);
  const pin=page.locator('[data-marker=gps]');
  await expect(pin).toHaveText('GPS target · (4.7, 1.6)');
  const pinBox=await pin.boundingBox();
  const consoleBox=await workspace(page).boundingBox();
  expect(pinBox.x+pinBox.width).toBeLessThan(consoleBox.x);
  await play(page).click();
  await expect(status(page)).toContainText('No rose to harvest at (4, 1)');
  await editor(page).fill('Move(4.7);');
  await play(page).click();
  await expect(programError(page)).toContainText('Line 1, column 6');
  await expect(programError(page)).toContainText('must be an int');
  await expect(page.locator('.code-error')).toHaveText('1');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await editor(page).fill(solutions['gps-rose']);
  await page.evaluate(()=>{
    const canvas=document.querySelector('.garden-canvas');
    window.zikiReadings={fps:[]};
    new MutationObserver(()=>window.zikiReadings.fps.push(Number(canvas.dataset.fps))).observe(canvas,{attributes:true,attributeFilter:['data-fps']});
  });
  await play(page).click();
  await expect(status(page)).toContainText('Rose harvested');
  const readings=await page.evaluate(()=>window.zikiReadings);
  expect(readings.fps.length).toBeGreaterThan(0);
  console.log('GPS route FPS samples:',readings.fps);
  await reset(page).click();
  await page.setViewportSize({width:1024,height:768});
  await expect.poll(()=>pin.evaluate(node=>node.style.left)).not.toBe('');
  await gallery(page,testInfo,'09-gps-1024x768');
  expect(await scene(page).boundingBox()).toEqual({x:0,y:0,width:1024,height:768});
  expect((await workspace(page).boundingBox()).x).toBeGreaterThan(512);
  for (const marker of await page.locator('.world-label:visible').all()) {
    const [label,focus]=await Promise.all([marker.boundingBox(),scene(page).locator('.scene-focus').boundingBox()]);
    expect(label.x).toBeGreaterThanOrEqual(focus.x);
    expect(label.x+label.width).toBeLessThanOrEqual(focus.x+focus.width);
    expect(label.y).toBeGreaterThanOrEqual(focus.y);
    expect(label.y+label.height).toBeLessThanOrEqual(focus.y+focus.height);
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await play(page).click();
  await expect(status(page)).toContainText('Rose harvested');
});
test('Route selection, battery configuration, tray counts and row width report success',async({page},testInfo)=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  for(const [id,text] of [['shorter-route','4 m route'],['charge-for-either','smallest setting'],['seed-tray','Dispenser empty'],['row-end','Rose harvested']]){
    await select(page,id);
    await editor(page).fill(solutions[id]);
    await play(page).click();
    await expect(status(page)).toContainText(text);
    await expect(status(page)).toHaveAttribute('data-outcome','success');
    if(id==='seed-tray') {
      await ready(page);
      await expect(page.locator('.bed-overlay')).toContainText('9/9');
      await gallery(page,testInfo,'12-tray-1280x720');
      await page.setViewportSize({width:390,height:844});
      const [controls,bed]=await Promise.all([displayControls(page).boundingBox(),page.locator('.bed-overlay').boundingBox()]);
      expect(controls.x+controls.width).toBeLessThan(bed.x);
      await page.setViewportSize({width:1280,height:720});
    }
  }
  await expect(page.getByRole('button',{name:'Next level'})).toHaveCount(0);
});
test('Run, reset, visibility pause, fixture changes, and fullscreen reuse one canvas',async({page},testInfo)=>{
  const errors=[],engineLogs=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',msg=>{if(msg.text().includes('Babylon.js v'))engineLogs.push(msg.text());});
  await page.goto('/');
  await ready(page);
  await select(page,'gps-rose');
  await ready(page);
  await editor(page).fill(solutions['gps-rose']);
  await play(page).click();
  await expect(page.locator('.code-active')).toHaveText('3');
  await page.evaluate(()=>{
    Object.defineProperty(document,'hidden',{value:true,configurable:true});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(450);
  await expect(status(page)).toHaveAttribute('data-outcome','running');
  await expect(page.locator('.code-active')).toHaveText('3');
  await page.evaluate(()=>{
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await reset(page).click();
  await expect(page.locator('.code-active')).toHaveCount(0);
  await expect(editor(page)).toHaveValue(solutions['gps-rose']);
  await expect(status(page)).toHaveAttribute('data-outcome','ready');
  await page.waitForTimeout(450);
  for(let i=0;i<10;i++){
    await play(page).click();
    await reset(page).click();
    await select(page,i%2===0?'fly-west':'gps-rose');
  }
  await ready(page);
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(engineLogs).toHaveLength(1);
  await expect(editor(page)).toHaveValue(solutions['gps-rose']);
  await page.getByRole('button',{name:'Restore starter'}).click();
  await expect(editor(page)).toHaveValue(levelsById['gps-rose'].starter);
  await displayControls(page).getByRole('button',{name:'Sound off'}).click();
  const soundOn=displayControls(page).getByRole('button',{name:'Sound on'});
  await expect(soundOn).toHaveAttribute('aria-pressed','true');
  await soundOn.click();
  await editor(page).fill(solutions['gps-rose']);
  await play(page).click();
  await expect(status(page)).toHaveAttribute('data-outcome','running');
  const fullscreen=displayControls(page).getByRole('button',{name:'Fullscreen',exact:true});
  if(await fullscreen.count()){
    await fullscreen.click();
    await expect.poll(()=>page.evaluate(()=>document.fullscreenElement===document.documentElement)).toBe(true);
    const exit=displayControls(page).getByRole('button',{name:'Exit fullscreen'});
    await expect(exit).toBeVisible();
    await exit.click();
    await expect(fullscreen).toBeVisible();
  }
  await page.setViewportSize({width:1023,height:768});
  expect((await workspace(page).boundingBox()).y).toBeGreaterThan((await scene(page).boundingBox()).height);
  await page.setViewportSize({width:390,height:844});
  await expect(editor(page)).toHaveValue(solutions['gps-rose']);
  await expect(status(page)).toHaveAttribute('data-outcome','success');
  expect(engineLogs).toHaveLength(1);
  await reset(page).click();
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:testInfo.outputPath('09-gps-mobile.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});
test('Display controls support keyboard focus and report unavailable fullscreen beside the garden',async({page})=>{
  await page.goto('/');
  await ready(page);
  const controls=displayControls(page);
  const sound=controls.getByRole('button',{name:'Sound off'});
  const fullscreen=controls.getByRole('button',{name:'Fullscreen',exact:true});
  await page.keyboard.press('Tab');
  await expect(sound).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(fullscreen).toBeFocused();
  await fullscreen.press('Enter');
  await expect(controls.getByRole('button',{name:'Exit fullscreen'})).toBeFocused();
  await page.evaluate(()=>document.exitFullscreen());
  await expect(fullscreen).toBeFocused();

  await page.setViewportSize({width:844,height:390});
  await page.evaluate(()=>{
    document.documentElement.requestFullscreen=async()=>{ throw new Error('Fullscreen unavailable'); };
  });
  await fullscreen.click();
  await expect(controls.getByRole('status')).toHaveText('Fullscreen is unavailable in this browser window.');
  await expect(status(page)).toHaveAttribute('data-outcome','ready');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(844);
  expect((await workspace(page).boundingBox()).y).toBeGreaterThan((await scene(page).boundingBox()).height);

  await page.addInitScript(()=>Object.defineProperty(document,'fullscreenEnabled',{value:false}));
  await page.reload();
  await expect(fullscreen).toHaveCount(0);
  await expect(sound).toBeVisible();
});
test('WebGL unavailable: flat map and reduced-motion keyboard sequence remain usable',async({page})=>{
  await useFlatMap(page);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await expect(scene(page)).toHaveAttribute('data-graphics','unavailable');
  await expect(page.getByText('WebGL isn’t available.',{exact:false})).toBeVisible();
  await editor(page).fill(solutions['first-harvest']);
  const drone = page.locator('.map-drone');
  const initialX = await drone.evaluate(node => node.getBoundingClientRect().x);
  const flight = drone.evaluate(node => new Promise(resolve => {
    const samples = [];
    function readFrame() {
      samples.push(node.getBoundingClientRect().x);
      if (document.querySelector('.status-strip').getAttribute('data-outcome') === 'success') {
        resolve(samples);
      } else {
        requestAnimationFrame(readFrame);
      }
    }
    requestAnimationFrame(readFrame);
  }));
  await editor(page).press('Meta+Enter');
  await expect(status(page)).toContainText('Rose harvested');
  const samples = await flight;
  const tileWidth = (samples.at(-1) - initialX) / 3;
  expect(tileWidth).toBeGreaterThan(10);
  for (let i = 0; i < 3; i++) {
    const halfway = initialX + (i + .5) * tileWidth;
    expect(samples.some(x => Math.abs(x - halfway) < tileWidth * .15)).toBe(true);
  }
  const fastestFrame = Math.max(...samples.slice(1).map((x, i) => x - samples[i]));
  expect(fastestFrame).toBeLessThan(tileWidth * .4);
});
test('A WebGL context loss cancels the current run and the same canvas rebuilds',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await select(page,'gps-rose');
  await ready(page);
  await editor(page).fill(solutions['gps-rose']);
  await play(page).click();
  await expect(page.locator('.code-active')).toHaveText('3');
  await page.evaluate(()=>{
    const canvas=document.querySelector('canvas');
    const gl=canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    window.zikiContextExtension=gl.getExtension('WEBGL_lose_context');
    window.zikiContextExtension.loseContext();
  });
  await expect(scene(page)).toHaveAttribute('data-graphics','lost');
  await expect(status(page)).toContainText('Flight reset');
  await expect(editor(page)).toHaveValue(solutions['gps-rose']);
  await page.evaluate(()=>window.zikiContextExtension.restoreContext());
  await ready(page);
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.emulateMedia({reducedMotion:'reduce'});
  await play(page).click();
  await expect(status(page)).toContainText('Rose harvested');
  expect(errors).toEqual([]);
});
