// Game Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game Variables
let gameState = 'countdown'; // countdown, playing, paused, roundOver
let countdown = 3;
let lastCountdownTime = Date.now();
let roundOverTime = 0;
let scores = [0, 0];
let showFight = false;
let fightTimer = 0;

// Audio
const bgMusic = document.getElementById('bgMusic');
const swordSound = document.getElementById('swordSound');
const magicSound = document.getElementById('magicSound');
const koSound = document.getElementById('koSound');

// Set audio volumes
bgMusic.volume = 0.1;
swordSound.volume = 0.1;
magicSound.volume = 0.1;
koSound.volume = 0.1;

// Input handling
const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    
    // Handle pause
    if (e.key === 'Escape' && gameState === 'playing') {
        gameState = 'paused';
        bgMusic.pause();
        document.getElementById('pauseMenu').style.display = 'block';
    } else if (e.key === 'Enter') {
        if (gameState === 'paused') {
            gameState = 'playing';
            bgMusic.play();
            document.getElementById('pauseMenu').style.display = 'none';
        } else if (gameState === 'roundOver' && Date.now() - roundOverTime > 1500) {
            resetRound();
        }
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// Fighter Class
class Fighter {
    constructor(x, y, width, height, isAI, characterType) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.velocityX = 0;
        this.velocityY = 0;
        this.isAI = isAI;
        this.characterType = characterType; // 'tanjiro' or 'demon'
        this.health = 100; // Same health for both characters
        this.isAlive = true;
        this.isJumping = false;
        this.isAttacking = false;
        this.attackCooldown = 0;
        this.isHit = false;
        this.hitCooldown = 0;
        this.flip = isAI;
        
        // Animation properties
        this.currentAction = 'idle';
        this.frameIndex = 0;
        this.frameTimer = 0;
        this.animationSpeed = 100;
        
        // AI properties
        if (this.isAI) {
            this.aiState = 'neutral'; // aggressive, defensive, neutral
            this.aiDecisionTimer = 0;
            this.targetDistance = 0;
            this.lastDirection = 0; // To prevent jittery movement
            this.idleTimer = 0; // For more natural idle behavior
            this.moveTimer = 0; // For smoother movement patterns
        }
        
        // Load sprites
        this.loadSprites();
    }
    
    loadSprites() {
        this.animations = {
            idle: { frames: 8, image: new Image() },
            run: { frames: 8, image: new Image() },
            jump: { frames: 2, image: new Image() },
            attack1: { frames: 6, image: new Image() },
            attack2: { frames: 6, image: new Image() },
            hit: { frames: 4, image: new Image() },
            death: { frames: 6, image: new Image() }
        };
        
        // Set sprite sources based on character
        const basePath = this.characterType === 'demon' ? 
            'demon-slayer-main/resources/images/characters/fighter2/Sprites/' :
            'demon-slayer-main/resources/images/characters/raiden/Sprites/';
            
        this.animations.idle.image.src = basePath + 'Idle.png';
        this.animations.run.image.src = basePath + 'Run.png';
        this.animations.jump.image.src = basePath + 'Jump.png';
        this.animations.attack1.image.src = basePath + 'Attack1.png';
        this.animations.attack2.image.src = basePath + 'Attack2.png';
        this.animations.hit.image.src = basePath + 'Take hit.png';
        this.animations.death.image.src = basePath + 'Death.png';
    }
    
    update(opponent) {
        if (gameState !== 'playing' && gameState !== 'roundOver') return;
        
        // Handle input or AI
        if (this.isAI) {
            this.updateAI(opponent);
        } else {
            this.handleInput();
        }
        
        // Apply gravity
        this.velocityY += 1.0;
        
        // Update position
        this.x += this.velocityX;
        this.y += this.velocityY;
        
        // Ground collision
        if (this.y + this.height > canvas.height - 100) {
            this.y = canvas.height - 100 - this.height;
            this.velocityY = 0;
            this.isJumping = false;
        }
        
        // Wall collision
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;
        
        // Face opponent
        this.flip = opponent.x > this.x ? false : true;
        
        // Update cooldowns
        if (this.attackCooldown > 0) this.attackCooldown--;
        if (this.hitCooldown > 0) {
            this.hitCooldown--;
            if (this.hitCooldown === 0) this.isHit = false;
        }
        
        // Update animation
        this.updateAnimation();
        
        // Check attack collision - different timing for AI vs player
        const hitFrame = this.isAI ? 100 : 30;
        if (this.isAttacking && this.attackCooldown === hitFrame) {
            this.checkAttackHit(opponent);
        }
    }
    
    updateAI(opponent) {
        if (!this.isAlive || gameState !== 'playing') return;
        
        // Calculate distance to opponent
        this.targetDistance = Math.abs(opponent.x - this.x);
        const verticalDistance = Math.abs(opponent.y - this.y);
        
        // AI decision making - slower and more stable
        this.aiDecisionTimer++;
        if (this.aiDecisionTimer > 90) { // Longer decision time for stability
            this.aiDecisionTimer = 0;
            
            // Choose AI behavior based on health and distance
            if (this.health < 25) {
                this.aiState = 'defensive';
            } else if (this.targetDistance < 200 && this.health > 50) {
                // Only aggressive when healthy and close
                this.aiState = 'aggressive';
            } else {
                this.aiState = 'neutral';
            }
        }
        
        // Reset velocity
        this.velocityX = 0;
        
        // AI Movement with better behavior
        const attackRange = 180;
        const comfortableRange = 120; // Range where AI stops moving
        
        // Update movement timer
        this.moveTimer++;
        
        if (this.aiState === 'aggressive') {
            // Only move if far from attack range
            if (this.targetDistance > attackRange) {
                // Smooth movement with consistent direction
                if (this.moveTimer > 30) { // Change direction every 30 frames
                    this.lastDirection = opponent.x < this.x ? -1 : 1;
                    this.moveTimer = 0;
                }
                this.velocityX = this.lastDirection * 3.5;
                if (!this.isAttacking && !this.isHit) this.currentAction = 'run';
            } else if (this.targetDistance > comfortableRange) {
                // Slower approach when getting close
                this.velocityX = (opponent.x < this.x ? -1 : 1) * 2;
                if (!this.isAttacking && !this.isHit) this.currentAction = 'run';
            } else {
                // Stop and face opponent when in comfortable range
                this.velocityX = 0;
                this.idleTimer++;
                
                // Attack after brief pause
                if (this.idleTimer > 40 && this.attackCooldown === 0 && verticalDistance < 50) {
                    if (Math.random() < 0.08) { // 8% chance
                        this.attack(Math.random() < 0.6 ? 1 : 2);
                        this.idleTimer = 0;
                    }
                }
            }
            
            // Jump occasionally when moving
            if (this.velocityX !== 0 && !this.isJumping && Math.random() < 0.008) {
                this.velocityY = -18;
                this.isJumping = true;
                if (!this.isAttacking && !this.isHit) this.currentAction = 'jump';
            }
        } else if (this.aiState === 'defensive') {
            // Move away from player when low health
            if (this.targetDistance < 300) {
                if (opponent.x < this.x) {
                    this.velocityX = 3; // Reduced from 5
                } else {
                    this.velocityX = -3; // Reduced from -5
                }
                if (!this.isAttacking && !this.isHit) this.currentAction = 'run';
            }
            
            // Very rare defensive attacks
            if (this.targetDistance < attackRange && this.attackCooldown === 0 && Math.random() < 0.02) { // Further reduced to 2%
                this.attack(1);
            }
        } else {
            // Neutral state - careful approach
            if (this.targetDistance > 300) {
                // Move slowly when far
                this.velocityX = (opponent.x < this.x ? -1 : 1) * 2.5;
                if (!this.isAttacking && !this.isHit) this.currentAction = 'run';
            } else if (this.targetDistance > 150) {
                // Walk when medium distance
                this.velocityX = (opponent.x < this.x ? -1 : 1) * 1.5;
                if (!this.isAttacking && !this.isHit) this.currentAction = 'run';
            } else {
                // Stop and observe when close
                this.velocityX = 0;
                this.idleTimer++;
                
                // Occasional calculated attacks
                if (this.idleTimer > 60 && this.attackCooldown === 0 && verticalDistance < 40) {
                    if (Math.random() < 0.05) { // 5% chance after waiting
                        this.attack(Math.random() < 0.5 ? 1 : 2);
                        this.idleTimer = 0;
                    }
                }
            }
        }
        
        // Set idle if not moving
        if (this.velocityX === 0 && !this.isJumping && !this.isAttacking && !this.isHit && this.isAlive) {
            this.currentAction = 'idle';
        } else if (this.velocityX !== 0) {
            // Reset idle timer when moving
            this.idleTimer = 0;
        }
    }
    
    handleInput() {
        if (!this.isAlive || gameState !== 'playing') return;
        
        this.velocityX = 0;
        
        // Player controls (Tanjiro) - Arrow keys for movement
        if (keys['ArrowLeft']) {
            this.velocityX = -7;
            if (!this.isAttacking && !this.isHit) this.currentAction = 'run';
        }
        if (keys['ArrowRight']) {
            this.velocityX = 7;
            if (!this.isAttacking && !this.isHit) this.currentAction = 'run';
        }
        if (keys['ArrowUp'] && !this.isJumping) {
            this.velocityY = -20;
            this.isJumping = true;
            if (!this.isAttacking && !this.isHit) this.currentAction = 'jump';
        }
        if (keys[' '] && this.attackCooldown === 0) { // Spacebar for attack
            this.attack(Math.random() < 0.5 ? 1 : 2); // Random attack type
        }
        
        // Set idle if not moving
        if (this.velocityX === 0 && !this.isJumping && !this.isAttacking && !this.isHit && this.isAlive) {
            this.currentAction = 'idle';
        } else if (this.velocityX !== 0) {
            // Reset idle timer when moving
            this.idleTimer = 0;
        }
    }
    
    attack(type) {
        this.isAttacking = true;
        // Much longer cooldown for AI to make it easier
        this.attackCooldown = this.isAI ? 120 : 40;
        this.currentAction = type === 1 ? 'attack1' : 'attack2';
        this.frameIndex = 0;
        
        // Play attack sound
        const sound = this.isAI ? magicSound : swordSound;
        sound.currentTime = 0;
        sound.play();
    }
    
    checkAttackHit(opponent) {
        // Create attack hitbox with better range
        const attackBox = {
            x: this.flip ? this.x - 80 : this.x + this.width,
            y: this.y + this.height/4,
            width: 80,
            height: this.height/2
        };
        
        // Debug log
        console.log(`${this.characterType} attacking:`, attackBox, 'Opponent:', {x: opponent.x, y: opponent.y, width: opponent.width, height: opponent.height});
        
        // Check collision
        if (attackBox.x < opponent.x + opponent.width &&
            attackBox.x + attackBox.width > opponent.x &&
            attackBox.y < opponent.y + opponent.height &&
            attackBox.y + attackBox.height > opponent.y &&
            opponent.hitCooldown === 0) {
            
            console.log(`${this.characterType} HIT ${opponent.characterType}!`);
            // Fair damage for both characters
            const damage = 15;
            opponent.takeDamage(damage);
        }
    }
    
    takeDamage(damage) {
        if (this.hitCooldown > 0) {
            console.log(`${this.characterType} still on cooldown, no damage`);
            return;
        }
        
        console.log(`${this.characterType} taking ${damage} damage! Health: ${this.health} -> ${this.health - damage}`);
        this.health -= damage;
        this.isHit = true;
        this.hitCooldown = 30;
        this.currentAction = 'hit';
        this.frameIndex = 0;
        
        // Knockback
        this.velocityX = this.flip ? 5 : -5;
        this.velocityY = -5;
        
        if (this.health <= 0) {
            this.health = 0;
            this.isAlive = false;
            this.currentAction = 'death';
            this.frameIndex = 0;
        }
        
        // Update UI
        this.updateHealthBar();
    }
    
    updateHealthBar() {
        const healthBar = document.getElementById(this.isAI ? 'player2-health' : 'player1-health');
        const hpText = document.getElementById(this.isAI ? 'player2-hp' : 'player1-hp');
        
        healthBar.style.width = this.health + '%';
        hpText.textContent = this.health;
        
        // Change health bar color based on health
        if (this.health < 30) {
            healthBar.style.background = 'linear-gradient(to right, #ff0000, #cc0000)';
        } else if (this.health < 60) {
            healthBar.style.background = 'linear-gradient(to right, #ffff00, #cccc00)';
        } else {
            healthBar.style.background = 'linear-gradient(to right, #00ff00, #00cc00)';
        }
    }
    
    updateAnimation() {
        this.frameTimer++;
        
        if (this.frameTimer >= this.animationSpeed / 15) {
            this.frameTimer = 0;
            this.frameIndex++;
            
            const animation = this.animations[this.currentAction];
            if (this.frameIndex >= animation.frames) {
                if (this.currentAction === 'death') {
                    this.frameIndex = animation.frames - 1;
                } else {
                    this.frameIndex = 0;
                    
                    // Reset states after animations
                    if (this.currentAction === 'attack1' || this.currentAction === 'attack2') {
                        this.isAttacking = false;
                    }
                    if (this.currentAction === 'hit') {
                        this.isHit = false;
                    }
                }
            }
        }
    }
    
    draw(ctx) {
        const animation = this.animations[this.currentAction];
        if (!animation.image.complete) return;
        
        const frameWidth = animation.image.width / animation.frames;
        const frameHeight = animation.image.height;
        
        // Larger character scale
        const scale = 4;
        const drawWidth = this.width * scale;
        const drawHeight = this.height * scale;
        
        ctx.save();
        
        // Flip sprite if needed
        if (this.flip) {
            ctx.scale(-1, 1);
            ctx.drawImage(
                animation.image,
                this.frameIndex * frameWidth, 0,
                frameWidth, frameHeight,
                -this.x - drawWidth + 40, this.y - drawHeight/2,
                drawWidth, drawHeight
            );
        } else {
            ctx.drawImage(
                animation.image,
                this.frameIndex * frameWidth, 0,
                frameWidth, frameHeight,
                this.x - 40, this.y - drawHeight/2,
                drawWidth, drawHeight
            );
        }
        
        ctx.restore();
        
        // Debug hitboxes (remove in production)
        if (false) {
            ctx.strokeStyle = this.isAI ? 'blue' : 'red';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x, this.y, this.width, this.height);
        }
    }
}

// Load background
const background = new Image();
background.src = 'image.png';

// Create fighters - Tanjiro (player) and Demon (AI)
const tanjiro = new Fighter(250, 400, 120, 180, false, 'tanjiro');
const demon = new Fighter(750, 380, 120, 180, true, 'demon'); // Demon starts 20px higher

// Game Functions
function drawBackground() {
    if (background.complete) {
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function drawCountdown() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    if (countdown > 0) {
        // Draw number countdown with shadow
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;
        
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 250px Arial';
        ctx.fillText(countdown, canvas.width/2, canvas.height/2);
        
        // Draw stroke for better visibility
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 8;
        ctx.strokeText(countdown, canvas.width/2, canvas.height/2);
        
        ctx.shadowBlur = 0;
    } else if (showFight) {
        // Draw "FIGHT!" text with animation
        const scale = 1 + (fightTimer / 30) * 0.3;
        ctx.save();
        ctx.translate(canvas.width/2, canvas.height/2);
        ctx.scale(scale, scale);
        
        ctx.shadowColor = 'red';
        ctx.shadowBlur = 20;
        
        ctx.fillStyle = '#FF0000';
        ctx.font = 'bold 180px Arial';
        ctx.fillText('FIGHT!', 0, 0);
        
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 6;
        ctx.strokeText('FIGHT!', 0, 0);
        
        ctx.restore();
        fightTimer++;
        
        if (fightTimer > 40) {
            gameState = 'playing';
            bgMusic.play();
            showFight = false;
            fightTimer = 0;
        }
    }
    
    if (Date.now() - lastCountdownTime > 1000 && countdown > 0) {
        countdown--;
        lastCountdownTime = Date.now();
        
        if (countdown === 0) {
            showFight = true;
        }
    }
}

function checkRoundOver() {
    if (!tanjiro.isAlive || !demon.isAlive) {
        gameState = 'roundOver';
        roundOverTime = Date.now();
        bgMusic.pause();
        koSound.play();
        
        // Update scores
        if (!tanjiro.isAlive) {
            scores[1]++;
            document.getElementById('player2-wins').textContent = scores[1];
            document.getElementById('winnerText').textContent = 'Demon Wins!';
        } else {
            scores[0]++;
            document.getElementById('player1-wins').textContent = scores[0];
            document.getElementById('winnerText').textContent = 'Tanjiro Wins!';
        }
        
        document.getElementById('koScreen').style.display = 'block';
    }
}

function resetRound() {
    // Reset Tanjiro
    tanjiro.health = 100;
    tanjiro.isAlive = true;
    tanjiro.x = 200;
    tanjiro.y = 400;
    tanjiro.currentAction = 'idle';
    tanjiro.frameIndex = 0;
    tanjiro.isAttacking = false;
    tanjiro.isHit = false;
    tanjiro.hitCooldown = 0;
    tanjiro.attackCooldown = 0;
    tanjiro.updateHealthBar();
    
    // Reset Demon
    demon.health = 100;
    demon.isAlive = true;
    demon.x = 800;
    demon.y = 380; // Keep demon 20px higher
    demon.currentAction = 'idle';
    demon.frameIndex = 0;
    demon.isAttacking = false;
    demon.isHit = false;
    demon.hitCooldown = 0;
    demon.attackCooldown = 0;
    demon.updateHealthBar();
    
    // Reset health bar colors
    document.getElementById('player1-health').style.background = 'linear-gradient(to right, #00ff00, #00cc00)';
    document.getElementById('player2-health').style.background = 'linear-gradient(to right, #00ff00, #00cc00)';
    
    // Reset game state
    gameState = 'countdown';
    countdown = 3;
    lastCountdownTime = Date.now();
    showFight = false;
    fightTimer = 0;
    document.getElementById('koScreen').style.display = 'none';
    bgMusic.currentTime = 0;
}

// Game Loop
function gameLoop() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    drawBackground();
    
    // Update and draw fighters
    tanjiro.update(demon);
    demon.update(tanjiro);
    tanjiro.draw(ctx);
    demon.draw(ctx);
    
    // Game state handling
    if (gameState === 'countdown') {
        drawCountdown();
    } else if (gameState === 'playing') {
        checkRoundOver();
    }
    
    requestAnimationFrame(gameLoop);
}

// Start game
gameLoop();