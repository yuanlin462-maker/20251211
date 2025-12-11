// Debug 開關
let showDebugOnScreen = false; // 是否顯示左上角與縮圖的 debug 訊息（預設關閉）
// 多動畫設定
let animations = {
  // 靜止狀態
  stop: { img: null, srcCandidates: ['1/stop/0.png'], frameWidth: 46, frameHeight: 47, totalFrames: 1, frameDelay: 8 },
  // 四個移動方向的動畫
  goUp: { img: null, srcCandidates: ['1/go/all.png'], frameWidth: 51, frameHeight: 51, totalFrames: 4, frameDelay: 6 },
  goDown: { img: null, srcCandidates: ['1/go/all.png'], frameWidth: 51, frameHeight: 51, totalFrames: 4, frameDelay: 6 },
  goLeft: { img: null, srcCandidates: ['1/go/all.png'], frameWidth: 51, frameHeight: 51, totalFrames: 4, frameDelay: 6 },
  goRight: { img: null, srcCandidates: ['1/go/all.png'], frameWidth: 51, frameHeight: 51, totalFrames: 4, frameDelay: 6 },
  // 特殊動作
  punch: { img: null, srcCandidates: ['1/打/all.png'], frameWidth: 60, frameHeight: 60, totalFrames: 13, frameDelay: 5 },

  // 新增：左邊的第二個角色（精靈表）
  // 加入常見可能路徑，確保 preload 有更多嘗試來源
  leftChar: { img: null, srcCandidates: ['2/stop_2.png', '2/stop_2/stop_2.png', '2/stop_2/all.png'], frameWidth: 40, frameHeight: 35, totalFrames: 3, frameDelay: 8 },
  // 新增：右邊的第三個角色（精靈表，3/stop_3 資料夾，12 幀，整張圖 343x24）
  // 新增：角色2的注視動畫 (150x39, 5幀)
  leftCharLook: { img: null, srcCandidates: ['2/look.png', '2/look/look.png', '2/look/all.png'], frameWidth: 30, frameHeight: 39, totalFrames: 5, frameDelay: 8 },
  // 新增：角色2的生氣動畫 (709x36, 17幀)
  leftCharAnger: { img: null, srcCandidates: ['2/生氣.png', '2/生氣/all.png'], frameWidth: 41, frameHeight: 36, totalFrames: 17, frameDelay: 5 },
  // 說明：
  //  - frameWidth/frameHeight：來源精靈格的寬/高（如果不正確，程式會在 runtime 自動計算）
  //  - displayWidth/displayHeight：畫面上要顯示的大小（可在此直接調整）
  rightChar: { img: null, srcCandidates: ['3/stop_3.png', '3/stop_3/stop_3.png', '3/stop_3/all.png'], frameWidth: 49, frameHeight: 24, totalFrames: 12, frameDelay: 6, displayWidth: 56, displayHeight: 48},
  // 新增：角色3的說話動畫 (256x39, 9幀)
  rightCharSpeak: { img: null, srcCandidates: ['3/speak.png', '3/speak/speak.png', '3/speak/all.png'], frameWidth: 28, frameHeight: 39, totalFrames: 9, frameDelay: 6 },
  // 新增：角色3的跌倒動畫 (769x39, 18幀)
  rightCharFall: { img: null, srcCandidates: ['3/跌倒.png', '3/跌倒/all.png'], frameWidth: 42, frameHeight: 39, totalFrames: 18, frameDelay: 5 }
};
let currentAnim = 'stop';
let currentFrame = 0;
let animateSprite = true; // 是否播放動畫；若為 false，角色會停在 idleFrame
let idleFrame = 0; // 默認靜止幀

// player movement
let playerX, playerY, velocityX = 0, speed = 3;
let keyRightPressed = false, keyLeftPressed = false, keyUpPressed = false, keyDownPressed = false;
let facingLeft = false;
let movementAllowed = true; // false while playing one-shot punch
let oneShotAnimName = null;
let oneShotStartFrame = 0;

// NPC 狀態管理 (角色2)
let char2State = 'idle'; // 'idle', 'hit'
let char2StateStartFrame = 0;

// NPC 狀態管理
let char3State = 'idle'; // 'idle', 'falling', 'down'
let char3StateStartFrame = 0;
let char3DownDuration = 60; // 倒在地上停留的影格數 (120 frames ≈ 2 秒 @ 60fps)

function preload() {
  // 載入所有動畫的圖檔 (每個動畫可能有多個候選來源)
  for (const key in animations) {
    const anim = animations[key];
    // if directly a src string, treat it as single candidate
    const candidates = anim.srcCandidates || (anim.src ? [anim.src] : []);
    const tryLoad = (idx) => {
      if (idx >= candidates.length) {
        console.warn(`No sprite loaded for ${key}`);
        return;
      }
      const src = candidates[idx];
      loadImage(src, (img) => {
        anim.img = img;
        console.log(`${key} sprite loaded OK from`, src);
      }, (err) => {
        console.warn(`${key} sprite load failed from`, src, err);
        tryLoad(idx + 1);
      });
    };
    tryLoad(0);
  }
}

function setup() {
  console.log('setup() called');
  createCanvas(windowWidth, windowHeight);
  // 初始化玩家位置與速度
  playerX = width / 2;
  playerY = height / 2;
  velocityX = 0;
  speed = 3;
  keyRightPressed = false;
  keyLeftPressed = false;
  // 確認動畫圖檔資訊 (如無載入會在 draw 時被跳過)
  console.log('setup finished, canvas size', width, height);
}

function draw() {
  background('#be95c4');
  
  // 決定當前 animation: one-shot > movement > stop
  if (oneShotAnimName) {
    currentAnim = oneShotAnimName;
  } else if (keyUpPressed) {
    currentAnim = 'goUp';
  } else if (keyDownPressed) {
    currentAnim = 'goDown';
  } else if (keyLeftPressed) { // 當按下左鍵
    currentAnim = 'goLeft';
    facingLeft = false; // 不翻轉，使用素材原始的朝左方向
  } else if (keyRightPressed) { // 當按下右鍵
    currentAnim = 'goRight';
    facingLeft = true; // 翻轉素材，使其朝右
  } else {
    currentAnim = 'stop';
  }
  const anim = animations[currentAnim];
  if (!anim || !anim.img) {
    // 如果資源沒載入就畫一個 placeholder（方便確認 playerX/Y 是否正確）
    fill(255, 0, 255);
    noStroke();
    ellipse(playerX, playerY, 32, 32);
    return;
  }

  // --- 動畫邏輯 ---
  const cols = max(1, floor(anim.img.width / anim.frameWidth));
  const rows = max(1, floor(anim.img.height / anim.frameHeight));
  const actualFrames = cols * rows;
  const framesCount = min(anim.totalFrames, actualFrames);
  
  if (oneShotAnimName === currentAnim) {
    // one-shot animation plays from its start until finished then stops
    const elapsed = frameCount - oneShotStartFrame; // 經過的幀數
    const frameIndex = floor(elapsed / anim.frameDelay);
    if (frameIndex >= framesCount) {
      // finished
      oneShotAnimName = null;
      movementAllowed = true;
      currentAnim = 'stop';
      currentFrame = 0;
    } else {
      currentFrame = frameIndex;
    }
  } else if (animateSprite) {
    currentFrame = floor(frameCount / anim.frameDelay) % framesCount;
  } else {
    currentFrame = idleFrame; // 站在原地（靜止）
  }
  
  // 計算要繪製的精靈位置
  let sx = (currentFrame % cols) * anim.frameWidth;
  let sy = floor(currentFrame / cols) * anim.frameHeight;
  
  // --- 玩家移動邏輯 ---
  let velocityY = 0;
  if (!movementAllowed) {
    // during one-shot animation, freeze horizontal/vertical movement
    velocityX = 0;
    velocityY = 0;
  } else if (keyRightPressed) {
    velocityX = speed;
    // facingLeft 的設定移到上面動畫選擇區塊，這裡只管速度
  } else if (keyLeftPressed) {
    velocityX = -speed;
    // facingLeft 的設定移到上面動畫選擇區塊，這裡只管速度
  } else {
    velocityX = 0;
  }
  
  if (movementAllowed) {
      if (keyUpPressed) {
        velocityY = -speed;
      } else if (keyDownPressed) {
        velocityY = speed;
      }
  }

  playerX += velocityX;
  playerY += velocityY;
  
  playerX = constrain(playerX, anim.frameWidth / 2, width - anim.frameWidth / 2);
  playerY = constrain(playerY, anim.frameHeight / 2, height - anim.frameHeight / 2);
  // 在畫布 playerX/playerY 繪製動畫

  // --- Y-Sort 繪圖順序調整 ---
  // 建立一個包含所有要繪製角色的陣列
  let drawables = [];

  // 1. 加入玩家角色
  drawables.push({
    y: playerY,
    draw: () => {
      imageMode(CENTER);
      push();
      translate(playerX, playerY);
      if (facingLeft) scale(-1, 1);
      image(anim.img, 0, 0, anim.frameWidth, anim.frameHeight, sx, sy, anim.frameWidth, anim.frameHeight);
      pop();
    }
  });

  // 2. 加入左邊角色 (角色2)
  const leftAnim = animations.leftChar;
  if (leftAnim && leftAnim.img) {
    const fixedX = width - 500; // 原本角色3的位置
    const fixedY = height * 0.5;
    drawables.push({
      y: fixedY,
      draw: () => {
        // --- 互動邏輯 ---
        const triggerDistance = 100;
        const d = dist(playerX, playerY, fixedX, fixedY);
        const isLooking = d < triggerDistance;

        let activeAnim;
        let currentFrameIndex;

        // --- 根據角色狀態決定動畫 ---
        if (char2State === 'hit') {
          const angerAnim = animations.leftCharAnger;
          activeAnim = angerAnim;
          const elapsed = frameCount - char2StateStartFrame;
          currentFrameIndex = floor(elapsed / angerAnim.frameDelay);
          if (currentFrameIndex >= angerAnim.totalFrames) {
            // 動畫播放完畢，恢復 idle 狀態
            char2State = 'idle';
          }
        } else { // 'idle' 狀態
          const lookAnim = animations.leftCharLook;
          activeAnim = (isLooking && lookAnim && lookAnim.img) ? lookAnim : leftAnim;
          currentFrameIndex = floor(frameCount / activeAnim.frameDelay) % activeAnim.totalFrames;
        }

        // --- 動畫幀計算 ---
        if (!activeAnim) activeAnim = leftAnim; // 避免 activeAnim 為空
        // 使用與角色3相同的精確寬度計算方法，避免閃爍
        const preciseFrameWidth = activeAnim.img.width / activeAnim.totalFrames;
        const sourceFrameWidth = floor(preciseFrameWidth); // 切割時仍用整數
        const sx = currentFrameIndex * preciseFrameWidth;
        const sy = 0; // 假設角色2的動畫都是單行

        // --- 繪製角色 ---
        if (activeAnim && activeAnim.img) {
          push();
          imageMode(CENTER);
          image(activeAnim.img, fixedX, fixedY, sourceFrameWidth, activeAnim.img.height, sx, sy, sourceFrameWidth, activeAnim.img.height);
          pop();
        }

        // --- 繪製對話框 (僅在靠近時) ---
        // 只有在 idle 狀態且靠近時才顯示對話框
        if (char2State === 'idle' && isLooking) {
          const dialogText = "請問你有什麼問題想問我的嗎?";
          const textPadding = 10;
          const boxHeight = 40;
          // 對話框位置基於當前顯示的動畫高度
          const boxYOffset = (activeAnim.displayHeight || activeAnim.img.height) / 2 + boxHeight / 2 + 10;
          push();
          textAlign(CENTER, CENTER);
          textSize(16);
          const boxWidth = textWidth(dialogText) + textPadding * 2;
          fill(255, 255, 255, 220);
          noStroke();
          rectMode(CENTER);
          rect(fixedX, fixedY - boxYOffset, boxWidth, boxHeight, 10);
          fill(0);
          text(dialogText, fixedX, fixedY - boxYOffset);
          pop();
        }
      }
    });
  }

  // 3. 加入右邊角色 (角色3)
  const rightAnim = animations.rightChar;
  if (rightAnim && rightAnim.img) {
    const fixedX = 500; // 原本角色2的位置
    const fixedY = height * 0.5;
    drawables.push({
      y: fixedY,
      draw: () => {
        // --- 互動邏輯 ---
        const triggerDistance = 100;
        const d = dist(playerX, playerY, fixedX, fixedY);
        const isSpeaking = d < triggerDistance;

        let activeAnim;
        let currentFrameIndex;

        const fallAnim = animations.rightCharFall;

        // --- 根據角色狀態決定動畫 ---
        if (char3State === 'falling') {
          activeAnim = fallAnim;
          const elapsed = frameCount - char3StateStartFrame;
          currentFrameIndex = floor(elapsed / fallAnim.frameDelay);
          // 當動畫播放到最後一幀時
          if (currentFrameIndex >= fallAnim.totalFrames - 1) {
            char3State = 'down'; // 切換到 'down' 狀態
            char3StateStartFrame = frameCount; // 重置計時器
            currentFrameIndex = fallAnim.totalFrames - 1; // 停在最後一幀
          }
        } else if (char3State === 'down') {
          activeAnim = fallAnim; // 繼續使用跌倒動畫的圖
          currentFrameIndex = fallAnim.totalFrames - 1; // 保持在最後一幀
          const elapsed = frameCount - char3StateStartFrame;
          // 如果停留時間已過
          if (elapsed >= char3DownDuration) {
            char3State = 'idle'; // 恢復 'idle' 狀態
          }
        } else {
          // 'idle' 狀態的預設互動邏輯
          const speakAnim = animations.rightCharSpeak;
          activeAnim = (isSpeaking && speakAnim && speakAnim.img) ? speakAnim : rightAnim;
          currentFrameIndex = floor(frameCount / activeAnim.frameDelay) % activeAnim.totalFrames;
        }

        // --- 動畫幀計算 ---
        if (!activeAnim) activeAnim = rightAnim; // 避免 activeAnim 為空
        const preciseFrameWidth = activeAnim.img.width / activeAnim.totalFrames;
        const sourceFrameWidth = floor(preciseFrameWidth);
        const sx = currentFrameIndex * preciseFrameWidth;
        const sy = 0; // 假設動畫都是單行

        // --- 繪製角色 ---
        const dispW = activeAnim.displayWidth || sourceFrameWidth;
        const dispH = activeAnim.displayHeight || activeAnim.img.height;
        // 確保動畫資源已載入
        if (activeAnim && activeAnim.img) {
            push();
            imageMode(CENTER);
            image(activeAnim.img, fixedX, fixedY, dispW, dispH, sx, sy, sourceFrameWidth, activeAnim.img.height);
            pop();
        }

        // --- 新增：繪製對話框 (僅在靠近時) ---
        // 只有在 idle 狀態且靠近時才顯示對話框
        if (char3State === 'idle' && isSpeaking && activeAnim !== fallAnim) {
          const dialogText = "你好，我的朋友，今天過得好嗎?";
          const textPadding = 10;
          const boxHeight = 40;
          // 對話框位置基於當前顯示的動畫高度
          const boxYOffset = dispH / 2 + boxHeight / 2 + 10;
          push();
          textAlign(CENTER, CENTER);
          textSize(16);
          const boxWidth = textWidth(dialogText) + textPadding * 2;
          fill(255, 255, 255, 220);
          noStroke();
          rectMode(CENTER);
          rect(fixedX, fixedY - boxYOffset, boxWidth, boxHeight, 10);
          fill(0);
          text(dialogText, fixedX, fixedY - boxYOffset);
          pop();
        }
      }
    });
  }

  // 4. 根據 Y 座標排序
  drawables.sort((a, b) => a.y - b.y);

  // 5. 依照排序後的順序繪製所有角色
  for (const drawable of drawables) {
    drawable.draw();
  }

  // --- Debug 資訊 ---
  if (showDebugOnScreen) {
    // 顯示目前狀態小提示（方便測試）
    fill(255);
    noStroke();
    textSize(14);
    text(`Use arrows to move; SPACE: punch; D: debug`, 10, 20);
    text(`Current: ${currentAnim}  frame:${currentFrame}`, 10, 52);

    // Debug: 顯示目前的幀與裁切座標
    if (anim && anim.img) {
      const debugSx = sx;
      const debugSy = sy;
      // 顯示一個縮小的整張 sprite sheet，在右下角
      const thumbsScale = 0.18; // 縮放比例，可調整
      const thumbW = anim.img.width * thumbsScale;
      const thumbH = anim.img.height * thumbsScale;
      const thumbX = width - thumbW - 10;
      const thumbY = height - thumbH - 10;
      imageMode(CORNER);
      image(anim.img, thumbX, thumbY, thumbW, thumbH);
      // 以紅框畫出當前裁切區（先把 sx,sy 轉成縮放座標）
      noFill();
      stroke(255, 0, 0);
      strokeWeight(2);
      const rectX = thumbX + debugSx * thumbsScale;
      const rectY = thumbY + debugSy * thumbsScale;
      const rectW = anim.frameWidth * thumbsScale;
      const rectH = anim.frameHeight * thumbsScale;
      rect(rectX, rectY, rectW, rectH);
      // 恢復 imageMode
      text(`frame ${currentFrame} sx:${debugSx}, sy:${debugSx}`, 10, height - 10);
    }
  }
}

// 鍵盤按下事件
function keyPressed() {
  if (keyCode === 32) { // SPACE 鍵
    // 發動攻擊動作（若目前不是攻擊動畫時）
    if (currentAnim !== 'punch') {
      oneShotAnimName = 'punch';
      oneShotStartFrame = frameCount;
      movementAllowed = false;

      // --- 新增：檢查與角色3的距離，只有靠近時才觸發 "hit" 狀態 ---
      const char3X = 500; // 角色3的X座標
      const char3Y = height * 0.5; // 角色3的Y座標
      const attackRange = 120; // 攻擊的有效範圍，可以比對話距離稍大
      const d = dist(playerX, playerY, char3X, char3Y);

      if (d < attackRange) {
        char3State = 'falling';
        char3StateStartFrame = frameCount;
      }

      // --- 新增：檢查與角色2的距離，只有靠近時才觸發 "hit" 狀態 ---
      const char2X = width - 500; // 角色2的X座標
      const char2Y = height * 0.5; // 角色2的Y座標
      const d2 = dist(playerX, playerY, char2X, char2Y);

      if (d2 < attackRange) {
        char2State = 'hit';
        char2StateStartFrame = frameCount;
      }
    }
  } else if (keyCode === 68) { // D 鍵
    // 切換 Debug 開關
    showDebugOnScreen = !showDebugOnScreen;
  } else if (keyCode === RIGHT_ARROW) {
    keyRightPressed = true;
  } else if (keyCode === LEFT_ARROW) {
    keyLeftPressed = true;
  } else if (keyCode === UP_ARROW) {
    keyUpPressed = true;
  } else if (keyCode === DOWN_ARROW) {
    keyDownPressed = true;
  }
}

// 鍵盤放開事件
function keyReleased() {
  if (keyCode === RIGHT_ARROW) {
    keyRightPressed = false;
  } else if (keyCode === LEFT_ARROW) {
    keyLeftPressed = false;
  } else if (keyCode === UP_ARROW) {
    keyUpPressed = false;
  } else if (keyCode === DOWN_ARROW) {
    keyDownPressed = false;
  }
}