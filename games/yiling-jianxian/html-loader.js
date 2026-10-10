(async function(config) {
  'use strict';
  const root = new URL('.', document.baseURI);
  const blobs = [];
  const pending = new Map();
  const queue = [];
  const cancelLoads = new Set();
  let failure = null;
  let clearResources = () => {};
  let active = 0, loaded = 0;
  const total = Object.values(config.records).reduce((sum, file) => sum + file.size, 0);
  const checksum = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
  const fail = error => {
    if (failure) return;
    failure = error;
    for (const job of queue.splice(0)) job.reject(error);
    for (const cancel of Array.from(cancelLoads)) cancel(error);
    clearResources();
    release();
    console.error(error);
    window.doraSetState('faulted', error.message || String(error));
  };
  const release = () => { for (const url of blobs) URL.revokeObjectURL(url); blobs.length = 0; };
  window.addEventListener('pagehide', event => { if (!event.persisted) { clearResources(); release(); } });
  function pump() {
    while (!failure && active < 4 && queue.length) {
      const {name, resolve, reject} = queue.shift();
      const record = config.records[name];
      const script = document.createElement('script');
      active++;
      let delivered = false, finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        script.remove();
        pending.delete(name);
        cancelLoads.delete(cancel);
        active--;
        pump();
      };
      const cancel = error => { reject(error); finish(); };
      const timer = setTimeout(() => { reject(new Error('Timed out loading ' + record.script)); finish(); }, 120000);
      cancelLoads.add(cancel);
      pending.set(name, encoded => {
        if (delivered) return;
        delivered = true;
        (async () => {
          const raw = atob(encoded);
          if (raw.length !== record.size) throw new Error('HTML asset size mismatch: ' + name);
          const bytes = new Uint8Array(raw.length);
          for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index);
          if (await checksum(bytes) !== record.sha256) throw new Error('HTML asset checksum mismatch: ' + name);
          if (failure) return;
          loaded += bytes.length;
          window.doraSetProgress(0.5 * loaded / total, 'Loading game resources…');
          resolve(bytes);
        })().catch(reject).finally(finish);
      });
      script.onload = () => { if (!delivered) { reject(new Error('Invalid HTML asset: ' + record.script)); finish(); } };
      script.onerror = () => { reject(new Error('Unable to load ' + record.script + '. Extract the entire ZIP before opening index.html.')); finish(); };
      script.src = new URL(record.script, root).href;
      document.body.appendChild(script);
    }
  }
  function read(name) {
    if (failure) return Promise.reject(failure);
    if (!Object.hasOwn(config.records, name)) return Promise.reject(new Error('Unknown HTML asset: ' + name));
    return new Promise((resolve, reject) => { queue.push({name, resolve, reject}); pump(); });
  }
  window.DoraHtmlPackage = Object.freeze({deliver: (name, encoded) => pending.get(name)?.(encoded)});
  try {
    if (!window.WebAssembly || !window.crypto?.subtle) throw new Error('Please use a modern browser with WebAssembly and Web Crypto support.');
    const names = Object.keys(config.records);
    const values = await Promise.all(names.map(read));
    const files = new Map(names.map((name, index) => [name, values[index]]));
    delete window.DoraHtmlPackage;
    let preload = files.get('dora-player-runtime.data').buffer;
    clearResources = () => {
      preload = null;
      delete Module.doraSnapshot;
      delete Module.wasmBinary;
      delete Module.getPreloadedPackage;
      files.clear();
      values.length = 0;
    };
    Module.wasmBinary = files.get('dora-player-runtime.wasm');
    Module.getPreloadedPackage = () => { const bytes = preload; preload = null; return bytes; };
    Module.doraSnapshot = {manifest: config.manifest, files: config.manifest.files.map(file => ({path: file.path, bytes: files.get(decodeURIComponent(file.url))}))};
    // file:// pages share an opaque origin: isolate saves by package directory.
    Module.doraStorageId = 'html-' + await checksum(new TextEncoder().encode(root.href));
    const audio = new Map();
    for (const [name, type] of [['dora-audio-mixer.wasm', 'application/wasm'], ['audio-worklet.js', 'text/javascript']]) {
      // A worklet module fetched from blob:null is rejected by Chromium on file://.
      // A data URL can be imported by the worklet without an origin or disk fetch.
      if (name === 'audio-worklet.js') {
        let source = '';
        for (const byte of files.get(name)) source += String.fromCharCode(byte);
        audio.set(name, 'data:text/javascript;base64,' + btoa(source));
        continue;
      }
      const url = URL.createObjectURL(new Blob([files.get(name)], {type}));
      audio.set(name, url);
      blobs.push(url);
    }
    Module.locateFile = (name, prefix = '') => audio.get(name) || new URL(name, prefix || root).href;
    const initialized = Module.onRuntimeInitialized;
    Module.onRuntimeInitialized = function() {
      clearResources();
      initialized?.();
    };
    const aborted = Module.onAbort;
    Module.onAbort = function(reason) {
      fail(new Error(String(reason || 'Runtime aborted')));
      aborted?.(reason);
    };
    const script = document.createElement('script');
    script.src = new URL('dora-player-runtime.js', root).href;
    script.onerror = () => fail(new Error('Unable to load the engine. Extract the entire ZIP before opening index.html.'));
    document.body.appendChild(script);
  } catch (error) { fail(error); }
})({"manifest":{"format":"dora-web-game","version":1,"engineVersion":"1.9.3","profile":"dora-preset","entry":"init.lua","files":[{"path":"Audio/array.wav","url":"assets/293f55bc68402eb1b0d9e4e7623558431740a0f7b09906e2e5c68f09558583c9/Audio/array.wav","size":72808,"sha256":"293f55bc68402eb1b0d9e4e7623558431740a0f7b09906e2e5c68f09558583c9","startup":true},{"path":"Audio/bgm.wav","url":"assets/762dc795b802e728bf70b5b7d6ed463cfe4a5f4397f7356af34ed842ce374a80/Audio/bgm.wav","size":5133284,"sha256":"762dc795b802e728bf70b5b7d6ed463cfe4a5f4397f7356af34ed842ce374a80","startup":true},{"path":"Audio/hero-hurt.wav","url":"assets/c76dd657bfe65cd3e0c6ace62130ac944416748cc0a071254effc7254a1d69d3/Audio/hero-hurt.wav","size":15038,"sha256":"c76dd657bfe65cd3e0c6ace62130ac944416748cc0a071254effc7254a1d69d3","startup":true},{"path":"Audio/monster-death.wav","url":"assets/608acb90e40ed9fd68d6937a386cd6972b33d58de226eb3e4078f0733a0001e4/Audio/monster-death.wav","size":29094,"sha256":"608acb90e40ed9fd68d6937a386cd6972b33d58de226eb3e4078f0733a0001e4","startup":true},{"path":"Audio/monster-hit.wav","url":"assets/131305a9735dbf48a4d4b8b97b09408b74872fb7a9bca8f188e265c6ddbd83e8/Audio/monster-hit.wav","size":11950,"sha256":"131305a9735dbf48a4d4b8b97b09408b74872fb7a9bca8f188e265c6ddbd83e8","startup":true},{"path":"Audio/slash1.wav","url":"assets/b580610b8b3d63d290905f37e50532c59164beb9b3ceb5da70ec4908203d0299/Audio/slash1.wav","size":15920,"sha256":"b580610b8b3d63d290905f37e50532c59164beb9b3ceb5da70ec4908203d0299","startup":true},{"path":"Audio/slash2.wav","url":"assets/550d991f60c0f46c4e49cdd5b57024660e9dc3804b263ea0581cad9dc6c03a3c/Audio/slash2.wav","size":19006,"sha256":"550d991f60c0f46c4e49cdd5b57024660e9dc3804b263ea0581cad9dc6c03a3c","startup":true},{"path":"Audio/slash3.wav","url":"assets/bc26cbcf269c12340fe0e783191f3b3315a2e65b163f5084118a92641d8c3eea/Audio/slash3.wav","size":23858,"sha256":"bc26cbcf269c12340fe0e783191f3b3315a2e65b163f5084118a92641d8c3eea","startup":true},{"path":"Audio/sword.wav","url":"assets/c90f717a4a3e447ee3491970f756324ecfac8dcec7a0c77f45d8d37e646d58c6/Audio/sword.wav","size":6658,"sha256":"c90f717a4a3e447ee3491970f756324ecfac8dcec7a0c77f45d8d37e646d58c6","startup":true},{"path":"Doc/SUBMISSION.md","url":"assets/4cca41f130811f3569d36a3f8a25d12eaf11da5a0b256e9e429a97f83d58d090/Doc/SUBMISSION.md","size":3244,"sha256":"4cca41f130811f3569d36a3f8a25d12eaf11da5a0b256e9e429a97f83d58d090","startup":true},{"path":"Doc/submission-cover.png","url":"assets/e40f83b133875cd64414f85a2c24b3447fe2e8c723e8242b18c688e1020affb7/Doc/submission-cover.png","size":2758965,"sha256":"e40f83b133875cd64414f85a2c24b3447fe2e8c723e8242b18c688e1020affb7","startup":true},{"path":"Doc/submission-icon.png","url":"assets/7405e97bf6b1e575c7d4780faac103a0e39b528a7131ddc9fdcda7da826f4456/Doc/submission-icon.png","size":2421723,"sha256":"7405e97bf6b1e575c7d4780faac103a0e39b528a7131ddc9fdcda7da826f4456","startup":true},{"path":"Doc/录屏_2026-09-25_08-40-19.mp4","url":"assets/ad3a4cdca6598c41907acbf859294773c2eae46697c556f24683c8c1055c3820/Doc/%E5%BD%95%E5%B1%8F_2026-09-25_08-40-19.mp4","size":13236367,"sha256":"ad3a4cdca6598c41907acbf859294773c2eae46697c556f24683c8c1055c3820","startup":true},{"path":"Doc/提交材料说明.md","url":"assets/f13912ae4c4630c7988966e96441feacabc03d2a35e5d6d7f6dc748e9d8a3e54/Doc/%E6%8F%90%E4%BA%A4%E6%9D%90%E6%96%99%E8%AF%B4%E6%98%8E.md","size":940,"sha256":"f13912ae4c4630c7988966e96441feacabc03d2a35e5d6d7f6dc748e9d8a3e54","startup":true},{"path":"Image/ghost-pixel-hurt-sheet.png","url":"assets/45c0d71447622f362cb80e3c184480f51da6f66a1a78c4f6ba28aaac42756d71/Image/ghost-pixel-hurt-sheet.png","size":1541345,"sha256":"45c0d71447622f362cb80e3c184480f51da6f66a1a78c4f6ba28aaac42756d71","startup":true},{"path":"Image/ghost-pixel-sheet.png","url":"assets/4b0b44e8664240acc7ff2ac61429576854cf3697aebc8e86c4b35aea4e93e148/Image/ghost-pixel-sheet.png","size":1265792,"sha256":"4b0b44e8664240acc7ff2ac61429576854cf3697aebc8e86c4b35aea4e93e148","startup":true},{"path":"Image/menu-reference-pixel-xianxia.png","url":"assets/dbd05ab2b399c2614825dc917d539706976c4fc3d9beca905da1059c58e5bf99/Image/menu-reference-pixel-xianxia.png","size":2295569,"sha256":"dbd05ab2b399c2614825dc917d539706976c4fc3d9beca905da1059c58e5bf99","startup":true},{"path":"Image/skill-array.png","url":"assets/8bdb301b3c6c8603d699678528d5ba9bf3faa44ea3ff858ceedccde697eb0b99/Image/skill-array.png","size":30109,"sha256":"8bdb301b3c6c8603d699678528d5ba9bf3faa44ea3ff858ceedccde697eb0b99","startup":true},{"path":"Image/skill-fly.png","url":"assets/e9bf9fd838a5216bcf253649d2b0b204e2553873a6a811f84ceb24769417732f/Image/skill-fly.png","size":17130,"sha256":"e9bf9fd838a5216bcf253649d2b0b204e2553873a6a811f84ceb24769417732f","startup":true},{"path":"Image/skill-sword.png","url":"assets/bfb73b563858081f6d9834a22b9118c03c34a80749dcdac468e41d01c187edd9/Image/skill-sword.png","size":10830,"sha256":"bfb73b563858081f6d9834a22b9118c03c34a80749dcdac468e41d01c187edd9","startup":true},{"path":"Image/sword-immortal-four-direction-sheet-v2.png","url":"assets/524b184db5d830e5a58ab1f0bd7de16e340a6522d65a5ab3d3c2c79a817af36a/Image/sword-immortal-four-direction-sheet-v2.png","size":1197892,"sha256":"524b184db5d830e5a58ab1f0bd7de16e340a6522d65a5ab3d3c2c79a817af36a","startup":true},{"path":"Image/sword-immortal-hurt-four-direction.png","url":"assets/f814cddb7432b865a7bc376edcd2556b49816ad2f0b95a2bb51ac112af4ad947/Image/sword-immortal-hurt-four-direction.png","size":570030,"sha256":"f814cddb7432b865a7bc376edcd2556b49816ad2f0b95a2bb51ac112af4ad947","startup":true},{"path":"Image/sword-immortal-pixel-sheet.png","url":"assets/0407ad55590150bb245e84397beb11e0dd7867cc9c8cd22da0b9fd1fcd67f5f6/Image/sword-immortal-pixel-sheet.png","size":907455,"sha256":"0407ad55590150bb245e84397beb11e0dd7867cc9c8cd22da0b9fd1fcd67f5f6","startup":true},{"path":"Image/sword-immortal.png","url":"assets/25a390e5054c4d4fc1737ac2a000e2e84c057f7d2a5e292824fd46492cb8910e/Image/sword-immortal.png","size":1793153,"sha256":"25a390e5054c4d4fc1737ac2a000e2e84c057f7d2a5e292824fd46492cb8910e","startup":true},{"path":"Image/yiling-modern-pixel-city.png","url":"assets/55b64f2bacea8942a9fb30ef0ea0a51c8a65755386e2c16811394df88b53332c/Image/yiling-modern-pixel-city.png","size":3320283,"sha256":"55b64f2bacea8942a9fb30ef0ea0a51c8a65755386e2c16811394df88b53332c","startup":true},{"path":"Image/yiling-night-city.png","url":"assets/c0ee036d89bafb48185328a6eb564f028f81a8ee6e4378fcf05b37312ffdfab9/Image/yiling-night-city.png","size":3055070,"sha256":"c0ee036d89bafb48185328a6eb564f028f81a8ee6e4378fcf05b37312ffdfab9","startup":true},{"path":"Image/yiling-open-plaza-pixel.png","url":"assets/584e0ed2d2a10d9d3f4d94d65b7dff3b6b2a6aff0cf9069ca7ee2a10e2d3f3df/Image/yiling-open-plaza-pixel.png","size":2096859,"sha256":"584e0ed2d2a10d9d3f4d94d65b7dff3b6b2a6aff0cf9069ca7ee2a10e2d3f3df","startup":true},{"path":"LICENSE","url":"assets/0d96a4ff68ad6d4b6f1f30f713b18d5184912ba8dd389f86aa7710db079abcb0/LICENSE","size":34523,"sha256":"0d96a4ff68ad6d4b6f1f30f713b18d5184912ba8dd389f86aa7710db079abcb0","startup":true},{"path":"README.md","url":"assets/77f9fe94eeb7ba11306ca9d60590f6856cbfc353b00821408048170e5c724b5f/README.md","size":5095,"sha256":"77f9fe94eeb7ba11306ca9d60590f6856cbfc353b00821408048170e5c724b5f","startup":true},{"path":"SwordRules.lua","url":"assets/5372ca8e3a0ec98a2c237660bc778fbaf03d75c5b7fdb7d4927d70812b488af8/SwordRules.lua","size":992,"sha256":"5372ca8e3a0ec98a2c237660bc778fbaf03d75c5b7fdb7d4927d70812b488af8","startup":true},{"path":"Tests.lua","url":"assets/f50515699e528867f6cd1b8199efbb41b4f593288e54c34d6da1dbc48e456e4b/Tests.lua","size":1160,"sha256":"f50515699e528867f6cd1b8199efbb41b4f593288e54c34d6da1dbc48e456e4b","startup":true},{"path":"generate_bgm.py","url":"assets/ea32c921672c417bb60a46afa106de387cff417c45f3b0a5ec61fd1865bbf933/generate_bgm.py","size":10345,"sha256":"ea32c921672c417bb60a46afa106de387cff417c45f3b0a5ec61fd1865bbf933","startup":true},{"path":"init.lua","url":"assets/1db4304bd30351da3690f1851c88f7f19e791e2ccb328f992a7bf34655545604/init.lua","size":42472,"sha256":"1db4304bd30351da3690f1851c88f7f19e791e2ccb328f992a7bf34655545604","startup":true},{"path":"夷陵剑仙-web-html.zip","url":"assets/e49392691323770438f60094364f03202cea8eaa2ef5d5fc92b9d493b4d0ac53/%E5%A4%B7%E9%99%B5%E5%89%91%E4%BB%99-web-html.zip","size":61018485,"sha256":"e49392691323770438f60094364f03202cea8eaa2ef5d5fc92b9d493b4d0ac53","startup":true}]},"records":{"dora-player-runtime.wasm":{"script":"html-assets/0.js","size":12954046,"sha256":"8cc31e2eeab206b01ce987967f6dfa367152444d8d5dd6404b58bcf1644a422a"},"dora-player-runtime.data":{"script":"html-assets/1.js","size":16902659,"sha256":"fe50cba2d69b78d41a06cc5a90970f34e64c02e4c68d04920b6066b918292d17"},"dora-audio-mixer.wasm":{"script":"html-assets/2.js","size":257583,"sha256":"77bc80abff5b7da9d8b70e82f0204542c6461616cb4a35f22ed8263e60d92329"},"audio-worklet.js":{"script":"html-assets/3.js","size":4811,"sha256":"0a69374be7060caf6651b1335b418df062345d4666d36f8d4638b06b2a97c76b"},"assets/293f55bc68402eb1b0d9e4e7623558431740a0f7b09906e2e5c68f09558583c9/Audio/array.wav":{"script":"html-assets/4.js","size":72808,"sha256":"293f55bc68402eb1b0d9e4e7623558431740a0f7b09906e2e5c68f09558583c9"},"assets/762dc795b802e728bf70b5b7d6ed463cfe4a5f4397f7356af34ed842ce374a80/Audio/bgm.wav":{"script":"html-assets/5.js","size":5133284,"sha256":"762dc795b802e728bf70b5b7d6ed463cfe4a5f4397f7356af34ed842ce374a80"},"assets/c76dd657bfe65cd3e0c6ace62130ac944416748cc0a071254effc7254a1d69d3/Audio/hero-hurt.wav":{"script":"html-assets/6.js","size":15038,"sha256":"c76dd657bfe65cd3e0c6ace62130ac944416748cc0a071254effc7254a1d69d3"},"assets/608acb90e40ed9fd68d6937a386cd6972b33d58de226eb3e4078f0733a0001e4/Audio/monster-death.wav":{"script":"html-assets/7.js","size":29094,"sha256":"608acb90e40ed9fd68d6937a386cd6972b33d58de226eb3e4078f0733a0001e4"},"assets/131305a9735dbf48a4d4b8b97b09408b74872fb7a9bca8f188e265c6ddbd83e8/Audio/monster-hit.wav":{"script":"html-assets/8.js","size":11950,"sha256":"131305a9735dbf48a4d4b8b97b09408b74872fb7a9bca8f188e265c6ddbd83e8"},"assets/b580610b8b3d63d290905f37e50532c59164beb9b3ceb5da70ec4908203d0299/Audio/slash1.wav":{"script":"html-assets/9.js","size":15920,"sha256":"b580610b8b3d63d290905f37e50532c59164beb9b3ceb5da70ec4908203d0299"},"assets/550d991f60c0f46c4e49cdd5b57024660e9dc3804b263ea0581cad9dc6c03a3c/Audio/slash2.wav":{"script":"html-assets/10.js","size":19006,"sha256":"550d991f60c0f46c4e49cdd5b57024660e9dc3804b263ea0581cad9dc6c03a3c"},"assets/bc26cbcf269c12340fe0e783191f3b3315a2e65b163f5084118a92641d8c3eea/Audio/slash3.wav":{"script":"html-assets/11.js","size":23858,"sha256":"bc26cbcf269c12340fe0e783191f3b3315a2e65b163f5084118a92641d8c3eea"},"assets/c90f717a4a3e447ee3491970f756324ecfac8dcec7a0c77f45d8d37e646d58c6/Audio/sword.wav":{"script":"html-assets/12.js","size":6658,"sha256":"c90f717a4a3e447ee3491970f756324ecfac8dcec7a0c77f45d8d37e646d58c6"},"assets/4cca41f130811f3569d36a3f8a25d12eaf11da5a0b256e9e429a97f83d58d090/Doc/SUBMISSION.md":{"script":"html-assets/13.js","size":3244,"sha256":"4cca41f130811f3569d36a3f8a25d12eaf11da5a0b256e9e429a97f83d58d090"},"assets/e40f83b133875cd64414f85a2c24b3447fe2e8c723e8242b18c688e1020affb7/Doc/submission-cover.png":{"script":"html-assets/14.js","size":2758965,"sha256":"e40f83b133875cd64414f85a2c24b3447fe2e8c723e8242b18c688e1020affb7"},"assets/7405e97bf6b1e575c7d4780faac103a0e39b528a7131ddc9fdcda7da826f4456/Doc/submission-icon.png":{"script":"html-assets/15.js","size":2421723,"sha256":"7405e97bf6b1e575c7d4780faac103a0e39b528a7131ddc9fdcda7da826f4456"},"assets/ad3a4cdca6598c41907acbf859294773c2eae46697c556f24683c8c1055c3820/Doc/录屏_2026-09-25_08-40-19.mp4":{"script":"html-assets/16.js","size":13236367,"sha256":"ad3a4cdca6598c41907acbf859294773c2eae46697c556f24683c8c1055c3820"},"assets/f13912ae4c4630c7988966e96441feacabc03d2a35e5d6d7f6dc748e9d8a3e54/Doc/提交材料说明.md":{"script":"html-assets/17.js","size":940,"sha256":"f13912ae4c4630c7988966e96441feacabc03d2a35e5d6d7f6dc748e9d8a3e54"},"assets/45c0d71447622f362cb80e3c184480f51da6f66a1a78c4f6ba28aaac42756d71/Image/ghost-pixel-hurt-sheet.png":{"script":"html-assets/18.js","size":1541345,"sha256":"45c0d71447622f362cb80e3c184480f51da6f66a1a78c4f6ba28aaac42756d71"},"assets/4b0b44e8664240acc7ff2ac61429576854cf3697aebc8e86c4b35aea4e93e148/Image/ghost-pixel-sheet.png":{"script":"html-assets/19.js","size":1265792,"sha256":"4b0b44e8664240acc7ff2ac61429576854cf3697aebc8e86c4b35aea4e93e148"},"assets/dbd05ab2b399c2614825dc917d539706976c4fc3d9beca905da1059c58e5bf99/Image/menu-reference-pixel-xianxia.png":{"script":"html-assets/20.js","size":2295569,"sha256":"dbd05ab2b399c2614825dc917d539706976c4fc3d9beca905da1059c58e5bf99"},"assets/8bdb301b3c6c8603d699678528d5ba9bf3faa44ea3ff858ceedccde697eb0b99/Image/skill-array.png":{"script":"html-assets/21.js","size":30109,"sha256":"8bdb301b3c6c8603d699678528d5ba9bf3faa44ea3ff858ceedccde697eb0b99"},"assets/e9bf9fd838a5216bcf253649d2b0b204e2553873a6a811f84ceb24769417732f/Image/skill-fly.png":{"script":"html-assets/22.js","size":17130,"sha256":"e9bf9fd838a5216bcf253649d2b0b204e2553873a6a811f84ceb24769417732f"},"assets/bfb73b563858081f6d9834a22b9118c03c34a80749dcdac468e41d01c187edd9/Image/skill-sword.png":{"script":"html-assets/23.js","size":10830,"sha256":"bfb73b563858081f6d9834a22b9118c03c34a80749dcdac468e41d01c187edd9"},"assets/524b184db5d830e5a58ab1f0bd7de16e340a6522d65a5ab3d3c2c79a817af36a/Image/sword-immortal-four-direction-sheet-v2.png":{"script":"html-assets/24.js","size":1197892,"sha256":"524b184db5d830e5a58ab1f0bd7de16e340a6522d65a5ab3d3c2c79a817af36a"},"assets/f814cddb7432b865a7bc376edcd2556b49816ad2f0b95a2bb51ac112af4ad947/Image/sword-immortal-hurt-four-direction.png":{"script":"html-assets/25.js","size":570030,"sha256":"f814cddb7432b865a7bc376edcd2556b49816ad2f0b95a2bb51ac112af4ad947"},"assets/0407ad55590150bb245e84397beb11e0dd7867cc9c8cd22da0b9fd1fcd67f5f6/Image/sword-immortal-pixel-sheet.png":{"script":"html-assets/26.js","size":907455,"sha256":"0407ad55590150bb245e84397beb11e0dd7867cc9c8cd22da0b9fd1fcd67f5f6"},"assets/25a390e5054c4d4fc1737ac2a000e2e84c057f7d2a5e292824fd46492cb8910e/Image/sword-immortal.png":{"script":"html-assets/27.js","size":1793153,"sha256":"25a390e5054c4d4fc1737ac2a000e2e84c057f7d2a5e292824fd46492cb8910e"},"assets/55b64f2bacea8942a9fb30ef0ea0a51c8a65755386e2c16811394df88b53332c/Image/yiling-modern-pixel-city.png":{"script":"html-assets/28.js","size":3320283,"sha256":"55b64f2bacea8942a9fb30ef0ea0a51c8a65755386e2c16811394df88b53332c"},"assets/c0ee036d89bafb48185328a6eb564f028f81a8ee6e4378fcf05b37312ffdfab9/Image/yiling-night-city.png":{"script":"html-assets/29.js","size":3055070,"sha256":"c0ee036d89bafb48185328a6eb564f028f81a8ee6e4378fcf05b37312ffdfab9"},"assets/584e0ed2d2a10d9d3f4d94d65b7dff3b6b2a6aff0cf9069ca7ee2a10e2d3f3df/Image/yiling-open-plaza-pixel.png":{"script":"html-assets/30.js","size":2096859,"sha256":"584e0ed2d2a10d9d3f4d94d65b7dff3b6b2a6aff0cf9069ca7ee2a10e2d3f3df"},"assets/0d96a4ff68ad6d4b6f1f30f713b18d5184912ba8dd389f86aa7710db079abcb0/LICENSE":{"script":"html-assets/31.js","size":34523,"sha256":"0d96a4ff68ad6d4b6f1f30f713b18d5184912ba8dd389f86aa7710db079abcb0"},"assets/77f9fe94eeb7ba11306ca9d60590f6856cbfc353b00821408048170e5c724b5f/README.md":{"script":"html-assets/32.js","size":5095,"sha256":"77f9fe94eeb7ba11306ca9d60590f6856cbfc353b00821408048170e5c724b5f"},"assets/5372ca8e3a0ec98a2c237660bc778fbaf03d75c5b7fdb7d4927d70812b488af8/SwordRules.lua":{"script":"html-assets/33.js","size":992,"sha256":"5372ca8e3a0ec98a2c237660bc778fbaf03d75c5b7fdb7d4927d70812b488af8"},"assets/f50515699e528867f6cd1b8199efbb41b4f593288e54c34d6da1dbc48e456e4b/Tests.lua":{"script":"html-assets/34.js","size":1160,"sha256":"f50515699e528867f6cd1b8199efbb41b4f593288e54c34d6da1dbc48e456e4b"},"assets/ea32c921672c417bb60a46afa106de387cff417c45f3b0a5ec61fd1865bbf933/generate_bgm.py":{"script":"html-assets/35.js","size":10345,"sha256":"ea32c921672c417bb60a46afa106de387cff417c45f3b0a5ec61fd1865bbf933"},"assets/1db4304bd30351da3690f1851c88f7f19e791e2ccb328f992a7bf34655545604/init.lua":{"script":"html-assets/36.js","size":42472,"sha256":"1db4304bd30351da3690f1851c88f7f19e791e2ccb328f992a7bf34655545604"},"assets/e49392691323770438f60094364f03202cea8eaa2ef5d5fc92b9d493b4d0ac53/夷陵剑仙-web-html.zip":{"script":"html-assets/37.js","size":61018485,"sha256":"e49392691323770438f60094364f03202cea8eaa2ef5d5fc92b9d493b4d0ac53"}}});
