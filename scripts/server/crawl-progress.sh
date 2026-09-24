#!/bin/bash
# 在服务器上运行：统计各搜索引擎的真实抓取进度（按 IP 段核实，不按 UA）。
# 用法：scp scripts/server/crawl-progress.sh ecs-user@47.238.7.93:/tmp/ && ssh … "bash /tmp/crawl-progress.sh"
#!/bin/bash
# Googlebot（按真实 IP 段核实）抓商品页的进度。
#
# 两个坑，都踩过：
#   1. UA 里是 `Googlebot`（大写 G），grep 必须加 -i —— `-h` 是「不显示文件名」，别混淆；
#   2. `access.log*` 里混着 .zst 压缩包（二进制），用 --exclude 排掉，否则输出会被
#      "Binary file matches" 污染。
set -uo pipefail

GOOGLE_IP='^(66\.249\.|66\.102\.|74\.125\.)'

echo "=== Googlebot 抓过的商品页（不同地址，前 12 个）==="
sudo grep -rhi --exclude='*.zst' googlebot /var/log/nginx/ 2>/dev/null \
  | awk -v re="$GOOGLE_IP" '$1 ~ re && $7 ~ /\/products\// {print $7}' \
  | sort -u | head -12

echo
sudo grep -rhi --exclude='*.zst' googlebot /var/log/nginx/ 2>/dev/null \
  | awk -v re="$GOOGLE_IP" '$1 ~ re && $7 ~ /\/products\// {print $7}' > /tmp/g-prod.txt
echo "商品页请求次数：$(wc -l < /tmp/g-prod.txt | tr -d ' ')  不同地址：$(sort -u /tmp/g-prod.txt | wc -l | tr -d ' ')"
echo "其中中文商品页（不同地址）：$(sort -u /tmp/g-prod.txt | grep -c '/zh/products/')"
echo "覆盖商品个数（按型号去重）：$(sort -u /tmp/g-prod.txt | sed -E 's#^/[a-z]{2}/products/##' | wc -l | tr -d ' ')"

echo
echo "=== Googlebot 抓过的非商品页 ==="
sudo grep -rhi --exclude='*.zst' googlebot /var/log/nginx/ 2>/dev/null \
  | awk -v re="$GOOGLE_IP" '$1 ~ re && $7 !~ /\/products\// {print $7}' \
  | sort | uniq -c | sort -rn | head -10

echo
echo "=== 有没有抓出非 2xx/3xx（异常信号）==="
sudo grep -rhi --exclude='*.zst' googlebot /var/log/nginx/ 2>/dev/null \
  | awk -v re="$GOOGLE_IP" '$1 ~ re && $9 !~ /^[23]/ {print $9, $7}' | sort | uniq -c | sort -rn | head -8
echo "(空 = 没有异常)"
