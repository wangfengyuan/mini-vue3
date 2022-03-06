// 最长递增子序列，返回最长递增子序列的长度

// 方法一：动态规划，动态规划两要素是状态定义和状态转移方程
// 时间复杂度：O(n^2)
// 状态定义：dp[i]表示以第i个元素结尾的最长递增子序列的长度
// 状态转移方程：dp[i] = max(dp[j]) + 1, j < i, nums[j] < nums[i]
function lengthOfLISDp(nums) {
  let len = nums.length;
  const dp = new Array(len).fill(1);
  let max = 1;
  for (let i = 0; i < len; i++) {
    for (let j = 0; j < i; j++) {
      if (arr[j] < arr[i]) {
        // 如果nums[j] < nums[i]，则dp[i] 取dp[j] + 1的最大值
        dp[i] = Math.max(dp[i], dp[j] + 1);
        // 更新记录max
        max = Math.max(max, dp[i]);
      }
    }
  }
  return max;
}


// 方法二：贪心 + 二分查找
// 思路是：贪心的思想，每次找到一个比前面的元素大的元素，然后在前面的元素中找到一个比它小的元素，然后替换他，即找到增长速度较慢的子序列
// 上面在前面的元素中找到一个比它小的元素的步骤，这个过程因为已经有序了，所以可以采用二分
// 时间复杂度：O(nlog(n))
// 比如这种情况：[1,4,5,2,3,7,0], 建一个栈，如果当前元素比栈顶元素大，则放进去，如果比他小，则找到最近的比他大的元素然后替换他
// 下面栈的变化如下，最后的结果的长度能保证是对的，但是栈中的数字并不一定对应原数组的顺序
// [1]
// [1,4]
// [1,4,5]
// [1,2,5]  // 2替换4
// [1,2,3]  // 3替换5
// [1,2,3,7] // 7放入栈中
// [0,2,3,7] // 0替换2

function lengthOfLIS(nums) {
  let stack = [];
  const len = nums.length;
  for (let i = 0; i < len; i++) {
    // 如果当前元素比栈顶元素大，则放进去，或者栈为空，代表第一个元素，则放进去
    if (nums[i] > stack[stack.length - 1] || stack.length === 0) {
      stack.push(nums[i]);
    } else {
      // 如果比他小，则找到最近的比他大的元素然后替换他
      let index = binarySearch(stack, nums[i]);
      stack[index] = nums[i];
    }
  }
  return stack.length;
}

function binarySearch(nums, target) {
  let left = 0;
  let right = nums.length - 1;
  while (left <= right) {
    let mid = Math.floor((left + right) / 2);
    if (nums[mid] === target) {
      return mid;
    } else if (nums[mid] < target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  return left;
}


// 返回最长递增子序列的索引
// 上面2中在替换的过程中贪心了，导致最后的结果错乱。
// 为了解决这个问题，使用的前驱节点的概念，需要再创建一个数组p。在步骤1往result中新增或者替换新值的时候，同时p新增一项，该项为当前项对应的前一项的索引。以数组[2,3,1,5,6,8,7,9,4] 为例，这样我们有了两个数组：result和p存储的都为索引
// 正常替换后的数组为[1,3,4,6,7,9]
// 上面数组对应的索引数组result为[2,1,8,4,6,7]
// p:[2,0,1,1,3,4,4,6,1]
// 根据result和p回溯上面的result数组后得到[0,1,3,4,6,7]最终结果



export default function lis(arr) {
  // 复制原数组,为了最后从结果result数组中溯源到真正的递增序列
  const p = arr.slice();
  // 存放索引，先把0即第一个索引放入
  const result = [0];
  const len = arr.length;
  let j, u, v, c;
  for (let i = 0; i < len; i++) {
    // 如果当前元素比栈顶元素大，则索引放进去，或者栈为空，代表第一个元素，则放进去
    // 当前最大元素索引为j
    j = result[result.length - 1]; 
    if (arr[i] > arr[j]) {
      // 如果比result中最后一个索引（即对应的目前的最大值还要大，则放入当前索引
      p[i] = j;
      result.push(i);
      continue;
    } 
    // 如果比他小，则找到最近的比他大的元素然后替换他
    // 二分所有result数组
    u = 0;
    v = result.length - 1;
    while (u < v) {
      c = ((u + v) / 2) | 0;
      // 因为result存储的是索引，中点对应的值为result[c]
      if (arr[result[c]] < arr[i]) {
        // 小的话，左边索引增加
        u = c + 1;
      } else {
        // 否则右边索引减少
        v = c;
      }
    }
    // 这时候的u索引对应的值就是比arr[i]大的最近的索引
    if (arr[i] < arr[result[u]]) {
      if (u > 0) {
        p[i] = result[u - 1];
      }
      result[u] = i;
    }
  }
  // console.log('p:', p);  // p: [2, 0, 1, 1, 3, 4, 4, 6, 1]
  // console.log('result:', result); // result: [ 2, 1, 8, 4, 6, 7 ]
  // 加下来利用回溯，根据上面的p和result得到正确的一个子序列
  u = result.length;
  v = result[u - 1];
  while (u-- > 0) {
    result[u] = v;
    v = p[v];
  }
  return result;
}

// console.log(getSequence3([2,3,1,5,6,8,7,9,4]));