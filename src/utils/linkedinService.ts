/**
 * LinkedIn Service - JavaScript injection scripts for WebView
 * Handles scanning posts, extracting data, and deleting posts
 */

export type SpeedMode = 'slow' | 'normal' | 'fast';

const DELAY_CONFIG: Record<SpeedMode, { min: number; max: number }> = {
  slow: { min: 3000, max: 6000 },
  normal: { min: 1500, max: 3000 },
  fast: { min: 500, max: 1500 },
};

/**
 * Generate a random delay for human-like behavior
 */
export const getRandomDelay = (speed: SpeedMode): number => {
  const { min, max } = DELAY_CONFIG[speed];
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Sleep for a given number of milliseconds
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * JS to inject into WebView to navigate to user's activity page
 */
export const NAVIGATE_TO_ACTIVITY = `
  (function() {
    window.location.href = 'https://www.linkedin.com/in/me/recent-activity/all/';
  })();
  true;
`;

/**
 * JS to inject into WebView to check if user is logged in
 */
export const CHECK_LOGIN_STATUS = `
  (function() {
    const isLoggedIn = !window.location.href.includes('/login') && 
                       !window.location.href.includes('/authwall') &&
                       (window.location.href.includes('linkedin.com/feed') || 
                        window.location.href.includes('linkedin.com/in/') ||
                        window.location.href.includes('linkedin.com/mynetwork'));
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'LOGIN_STATUS',
      isLoggedIn: isLoggedIn,
      currentUrl: window.location.href
    }));
  })();
  true;
`;

/**
 * JS to inject to scroll down and collect posts from the activity page
 */
export const SCAN_POSTS_SCRIPT = `
  (function() {
    try {
      const posts = [];
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'DEBUG_LOG',
        message: 'SCAN: URL = ' + window.location.href
      }));
      
      // PRIMARY selector from Chrome extension (most precise)
      // This finds actual activity posts with LinkedIn URNs
      const selectors = [
        'div[data-urn^="urn:li:activity"]',
        '.feed-shared-update-v2',
        '.profile-creator-shared-feed-update__container'
      ];
      
      let postElements = [];
      let matchedSelector = '';
      for (const selector of selectors) {
        const els = document.querySelectorAll(selector);
        if (els.length > 0) {
          postElements = Array.from(els);
          matchedSelector = selector;
          break;
        }
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'DEBUG_LOG',
        message: 'SCAN: Found ' + postElements.length + ' posts via: ' + matchedSelector
      }));
      
      if (postElements.length === 0) {
        // Debug: dump all data-urn values on page
        const allUrns = document.querySelectorAll('[data-urn]');
        const urnList = Array.from(allUrns).map(el => el.getAttribute('data-urn')).join(', ');
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'DEBUG_LOG',
          message: 'SCAN: No posts! All data-urn values: ' + urnList.substring(0, 500)
        }));
      }
      
      postElements.forEach((el, index) => {
        try {
          let urn = el.getAttribute('data-urn') || '';
          if (!urn || !urn.includes('activity')) {
            urn = 'post-' + index + '-' + Date.now();
          }

          // Text extraction (from Chrome ext: .feed-shared-text, .feed-shared-update-v2__description)
          const textEl = el.querySelector('.feed-shared-text') || 
                         el.querySelector('.feed-shared-update-v2__description') || 
                         el.querySelector('.break-words') ||
                         el.querySelector('span[dir="ltr"]');
          const text = textEl ? textEl.textContent.trim().substring(0, 200) : '';
          
          // Type detection (from Chrome ext selectors)
          let type = 'text';
          if (el.querySelector('.update-components-image')) type = 'image';
          if (el.querySelector('.update-components-video')) type = 'video';
          if (el.querySelector('.update-components-document')) type = 'document';
          if (el.querySelector('.update-components-poll')) type = 'poll';
          if (el.querySelector('.update-components-mini-update-v2')) type = 'repost';
          
          // Engagement (from Chrome ext)
          const likesEl = el.querySelector('.social-details-social-counts__reactions-count');
          const commentsEl = el.querySelector('.social-details-social-counts__comments');
          const likes = likesEl ? parseInt(likesEl.textContent.replace(/[^0-9]/g, '') || '0') : 0;
          const comments = commentsEl ? parseInt(commentsEl.textContent.replace(/[^0-9]/g, '') || '0') : 0;
          
          // Menu check
          const hasMenu = !!(el.querySelector('.feed-shared-control-menu__trigger') ||
                          el.querySelector('button[aria-label*="more action"]'));
          
          posts.push({
            id: urn,
            text: text || '(No text)',
            type: type,
            date: '',
            likes: likes,
            comments: comments,
            visibility: 'public',
            url: '',
            elementIndex: index,
            hasMenu: hasMenu
          });
        } catch (e) {}
      });
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'SCAN_RESULTS',
        posts: posts,
        totalFound: posts.length
      }));
    } catch (e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'SCAN_ERROR',
        error: e.toString()
      }));
    }
  })();
  true;
`;

/**
 * JS to scroll down the page to load more posts
 */
export const SCROLL_DOWN_SCRIPT = `
  (function() {
    window.scrollBy({ top: window.innerHeight * 2, behavior: 'smooth' });
    setTimeout(() => {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'SCROLL_DONE',
        scrollY: window.scrollY,
        innerHeight: window.innerHeight,
        totalHeight: document.documentElement.scrollHeight
      }));
    }, 1500);
  })();
  true;
`;

/**
 * JS to check if posts are loaded on the page (polls until found or timeout)
 */
export const WAIT_FOR_POSTS_SCRIPT = `
  (function() {
    var attempts = 0;
    var maxAttempts = 20;
    
    function checkPosts() {
      attempts++;
      var posts = document.querySelectorAll('div[data-urn^="urn:li:activity"], .feed-shared-update-v2');
      
      if (posts.length > 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'POSTS_READY',
          count: posts.length
        }));
      } else if (attempts < maxAttempts) {
        setTimeout(checkPosts, 500);
      } else {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'POSTS_READY',
          count: 0,
          timeout: true
        }));
      }
    }
    
    checkPosts();
  })();
  true;
`;

/**
 * Generate JS to delete a specific post by clicking its menu and selecting delete
 */
export const getDeletePostScript = (postId: string, postIndex: number): string => `
  (function() {
    try {
      console.log('DELETE (2024 Logic): Starting for post ${postId} at index ${postIndex}');
      
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));

      async function performDelete() {
        // 1. Find the post
        let post = document.querySelector('[data-urn="${postId}"]');
        if (!post) {
           const allPosts = document.querySelectorAll('div[data-urn^="urn:li:activity"], .feed-shared-update-v2');
           post = allPosts[${postIndex}];
        }

        if (!post) {
          throw new Error('Post element not found');
        }

        post.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(500);

        // 2. Click Menu Button (Exact 2024 Repo Selector)
        const menuBtn = post.querySelector('.feed-shared-control-menu__trigger');
        if (!menuBtn) {
           throw new Error('Menu button (.feed-shared-control-menu__trigger) not found');
        }

        menuBtn.click();
        await sleep(1200); // Wait for menu (matches repo)

        // 3. Find Delete Option (Exact 2024 Repo Selector)
        // Repo looks for .feed-shared-control-menu__headline containing "Delete"
        const headlines = Array.from(document.querySelectorAll('.feed-shared-control-menu__headline'));
        const deleteOption = headlines.find(el => el.textContent.trim().includes('Delete'));

        if (!deleteOption) {
           // Fallback to old logic if 2024 selector fails
           console.log('2024 selector failed, trying fallback...');
           const items = document.querySelectorAll('.feed-shared-control-menu__item, .artdeco-dropdown__item');
           const fallbackItem = Array.from(items).find(i => i.textContent.includes('Delete'));
           if (fallbackItem) {
             fallbackItem.click();
           } else {
             throw new Error('Delete option not found in menu');
           }
        } else {
           deleteOption.click();
        }

        await sleep(1500);

        // 4. Confirm Deletion (Exact 2024 Repo Selector)
        // Repo looks for button.artdeco-button--primary with "Delete"
        const buttons = Array.from(document.querySelectorAll('button.artdeco-button--primary'));
        const confirmBtn = buttons.find(b => b.textContent.trim().includes('Delete'));

        if (confirmBtn) {
          confirmBtn.click();
          await sleep(1000);
          window.ReactNativeWebView.postMessage(JSON.stringify({
             type: 'DELETE_RESULT', postIndex: ${postIndex}, success: true
          }));
        } else {
          // Maybe it didn't need confirmation? Or failed?
          console.log('No confirm button found, checking if post is gone...');
          window.ReactNativeWebView.postMessage(JSON.stringify({
             type: 'DELETE_RESULT', postIndex: ${postIndex}, success: true, warning: 'No confirm modal detected'
          }));
        }
      }

      performDelete().catch(err => {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'DELETE_RESULT', postIndex: ${postIndex}, success: false,
          error: err.toString()
        }));
      });

    } catch (e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'DELETE_RESULT', postIndex: ${postIndex}, success: false,
        error: e.toString()
      }));
    }
  })();
  true;
`;

/**
 * JS to detect captcha or anti-bot checks
 */
export const CHECK_SAFETY_SCRIPT = `
  (function () {
    const isCaptcha = document.querySelector('.captcha, [data-captcha], #captcha-internal') !== null;
    const isAuthwall = window.location.href.includes('/authwall') || window.location.href.includes('/checkpoint');
    const isSessionExpired = document.querySelector('.login-form, #username') !== null && !window.location.href.includes('/login');

    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'SAFETY_CHECK',
      isCaptcha: isCaptcha,
      isAuthwall: isAuthwall,
      isSessionExpired: isSessionExpired
    }));
  })();
true;
`;

/**
 * Filter posts based on user criteria
 */
export interface FilterCriteria {
  dateRange: 'all' | 'today' | '7days' | '30days' | 'custom';
  customDateStart?: string;
  customDateEnd?: string;
  postTypes: string[];
  minLikes?: number;
  maxLikes?: number;
  noLikes: boolean;
  noComments: boolean;
  includeKeywords: string[];
  excludeKeywords: string[];
  visibility: 'all' | 'public' | 'connections';
}

export const DEFAULT_FILTERS: FilterCriteria = {
  dateRange: 'all',
  postTypes: [],
  noLikes: false,
  noComments: false,
  includeKeywords: [],
  excludeKeywords: [],
  visibility: 'all',
};

export const filterPosts = (
  posts: Array<{
    id: string;
    text: string;
    type: string;
    date: string;
    likes: number;
    comments: number;
    visibility: string;
  }>,
  filters: FilterCriteria,
): typeof posts => {
  return posts.filter(post => {
    // Post type filter
    if (filters.postTypes.length > 0 && !filters.postTypes.includes(post.type)) {
      return false;
    }

    // Engagement filters
    if (filters.noLikes && post.likes > 0) return false;
    if (filters.noComments && post.comments > 0) return false;
    if (filters.minLikes !== undefined && post.likes < filters.minLikes) return false;
    if (filters.maxLikes !== undefined && post.likes > filters.maxLikes) return false;

    // Keyword filters
    const textLower = post.text.toLowerCase();
    if (filters.includeKeywords.length > 0) {
      const hasIncluded = filters.includeKeywords.some(kw =>
        textLower.includes(kw.toLowerCase()),
      );
      if (!hasIncluded) return false;
    }
    if (filters.excludeKeywords.length > 0) {
      const hasExcluded = filters.excludeKeywords.some(kw =>
        textLower.includes(kw.toLowerCase()),
      );
      if (hasExcluded) return false;
    }

    // Visibility filter
    if (filters.visibility !== 'all' && post.visibility !== filters.visibility) {
      return false;
    }

    return true;
  });
};
