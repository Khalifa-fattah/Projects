# دليل أوامر Git — Projects (الكمبيوتر Cmder + الهاتف Termux)

المستودع: `git@github.com:Khalifa-fattah/Projects.git`
مسار الكمبيوتر: `D:\Projects`
مسار الهاتف: `/storage/emulated/0/Projects`
المشاريع المنشورة: داخل `Projects\Published` وكل مشروع له مستودع GitHub مستقل (القسم 2ب)
طريقة الاتصال: SSH فقط على الجهازين

---

## 0. الإعداد لأول مرة (مرة واحدة فقط لكل جهاز)

### الكمبيوتر (Cmder)

```bash
git --version
```
التأكد أن Git مثبت.

```bash
git config --global user.name "Khalifa Fattah"
git config --global user.email "khlifa000khlifa@gmail.com"
```
تعريف اسمك وبريدك، وسيظهران في كل commit.

```bash
git config --global init.defaultBranch main
```
جعل اسم الفرع الافتراضي `main` عند أي `git init` جديد.

```bash
git config --list
```
عرض كل الإعدادات الحالية للتأكد.

### الهاتف (Termux)

```bash
termux-setup-storage
```
منح Termux صلاحية الوصول لذاكرة الهاتف (تظهر نافذة صلاحيات، وافق).

```bash
pkg update && pkg upgrade
pkg install git openssh
```
تحديث الحزم وتثبيت Git وSSH.

```bash
git config --global user.name "khalifa-fattah"
git config --global user.email "khlifa000khlifa@gmail.com"
git config --global --add safe.directory '*'
```
نفس تعريف الهوية، والسطر الأخير يمنع خطأ "dubious ownership" لأن ذاكرة الهاتف ملكيتها تختلف عن مستخدم Termux. استخدمت `'*'` ليشمل Projects وكل مشاريع Published دفعة واحدة (لا بأس بها على هاتفك الشخصي).

---

## 1. إعداد مفتاح SSH (مرة واحدة لكل جهاز)

```bash
ssh-keygen -t ed25519 -C "khlifa000khlifa@gmail.com"
```
إنشاء مفتاح SSH. اضغط Enter للموافقة على المسار الافتراضي.

```bash
cat ~/.ssh/id_ed25519.pub
```
عرض المفتاح العام. انسخه وأضفه في GitHub: Settings ← SSH and GPG keys ← New SSH key.

```bash
ssh -T git@github.com
```
اختبار الاتصال. الرد الناجح: `Hi Khalifa-fattah! You've successfully authenticated`.

---

## 2. رفع مشروع جديد إلى GitHub (لأول مرة)

أولاً أنشئ مستودعاً فارغاً على موقع GitHub (بدون README)، ثم:

```bash
cd /d "D:\Projects\اسم-المشروع"
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin git@github.com:Khalifa-fattah/اسم-المستودع.git
git push -u origin main
```

| الأمر | وظيفته |
|---|---|
| `git init` | تحويل المجلد إلى مستودع Git |
| `git add .` | تجهيز كل الملفات للحفظ |
| `git commit -m "..."` | حفظ نسخة مسماة من التعديلات محلياً |
| `git branch -M main` | تسمية الفرع الرئيسي `main` |
| `git remote add origin <رابط>` | ربط المجلد بمستودع GitHub |
| `git push -u origin main` | رفع الملفات، و `-u` تجعل `git push` و`git pull` لاحقاً بدون تفاصيل |

ملاحظة: استخدم دائماً رابط SSH (يبدأ بـ `git@github.com:`) وليس رابط HTTPS، حتى لا يطلب منك كلمة مرور.

---

## 2ب. مشاريع Published (لكل مشروع مستودع منفرد)

الشكل عندك:

```
Projects/                  ← المستودع الرئيسي (Projects)
└── Published/             ← المشاريع المنشورة
    ├── Shortcuts/         ← مستودع مستقل
    └── مشروع-آخر/         ← مستودع مستقل
```

**مشكلة مهمة:** وجود مستودع داخل مستودع يجعل `git add .` في Projects يعطي تحذير `adding embedded git repository`، ويسجل المجلد كرابط فارغ بدل ملفاته.
**الحل:** اجعل المستودع الرئيسي يتجاهل Published بالكامل.

### أ) تجاهل Published في المستودع الرئيسي (مرة واحدة)

الكمبيوتر:
```bash
cd /d D:\Projects
echo Published/>> .gitignore
git add .gitignore
git commit -m "Ignore Published folder"
git push
```

الهاتف:
```bash
echo "Published/" >> /storage/emulated/0/Projects/.gitignore
git -C /storage/emulated/0/Projects add .gitignore
git -C /storage/emulated/0/Projects commit -m "Ignore Published folder"
HOME=/data/data/com.termux/files/home git -C /storage/emulated/0/Projects -c core.compression=0 push
```

إذا كنت أضفت Published سابقاً بالخطأ إلى المستودع الرئيسي:
```bash
git rm -r --cached Published
git commit -m "Stop tracking Published"
git push
```
(`--cached` يحذفه من تتبع Git فقط ولا يحذف الملفات من جهازك.)

### ب) نشر مشروع جديد من Published

أنشئ مستودعاً فارغاً على GitHub باسم المشروع، ثم:

```bash
cd /d "D:\Projects\Published\اسم-المشروع"
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin git@github.com:Khalifa-fattah/اسم-المستودع.git
git push -u origin main
```

### ج) العمل اليومي على مشروع من Published

ادخل مجلد المشروع أولاً، فتصبح كل أوامر القسم 4 تخصه وحده:

```bash
cd /d D:\Projects\Published\Shortcuts
git pull
git add .
git commit -m "Update from PC"
git push
```

على الهاتف:
```bash
cd ~
git -C /storage/emulated/0/Projects/Published/Shortcuts pull
git -C /storage/emulated/0/Projects/Published/Shortcuts add .
git -C /storage/emulated/0/Projects/Published/Shortcuts commit -m "Update from phone"
HOME=/data/data/com.termux/files/home git -C /storage/emulated/0/Projects/Published/Shortcuts -c core.compression=0 push
```

### د) نقل مشروع Published إلى الجهاز الآخر

مستودع Projects لا ينقل Published (لأنه متجاهَل)، فكل مشروع يُنزَّل بنفسه:

```bash
cd /d D:\Projects\Published
git clone git@github.com:Khalifa-fattah/Shortcuts.git
```

وعلى الهاتف:
```bash
cd /storage/emulated/0/Projects/Published
git clone git@github.com:Khalifa-fattah/Shortcuts.git
```

بعد ذلك يتزامن بـ `git pull` و`git push` داخل مجلد المشروع نفسه.

### هـ) تنبيه: انتبه أي مستودع أنت فيه

الأمر يعمل على أقرب مجلد `.git` فوقك. للتأكد قبل `push`:
```bash
git remote -v
```
يعرض رابط المستودع الحالي، فتعرف هل أنت في Projects أم في مشروع من Published.

---

## 3. تنزيل مشروع من GitHub (clone)

### الكمبيوتر

```bash
cd /d D:
git clone git@github.com:Khalifa-fattah/Projects.git
```

### الهاتف

```bash
cd /storage/emulated/0
git clone git@github.com:Khalifa-fattah/Projects.git
```

خيارات إضافية:

```bash
git clone <الرابط> اسم-مجلد-آخر
```
التنزيل داخل مجلد باسم مختلف.

```bash
git clone --depth 1 <الرابط>
```
تنزيل آخر نسخة فقط (أسرع وأخف، مفيد للمشاريع الكبيرة).

```bash
git clone -b اسم-الفرع --single-branch <الرابط>
```
تنزيل فرع معين فقط.

---

## 4. الروتين اليومي: تعديل ورفع

### الكمبيوتر

```bash
cd /d D:\Projects
git pull
```
جلب آخر التعديلات قبل البدء (مهم جداً إن عدلت من الهاتف).

```bash
git status
git add .
git commit -m "Update from PC"
git push
```

### الهاتف

```bash
cd ~
git -C /storage/emulated/0/Projects pull
```
جلب آخر التعديلات قبل البدء.

```bash
cd ~
git -C /storage/emulated/0/Projects add .
git -C /storage/emulated/0/Projects commit -m "Update from phone"
HOME=/data/data/com.termux/files/home git -C /storage/emulated/0/Projects -c core.compression=0 push
```
- `git -C <مسار>` ينفذ الأمر داخل ذلك المجلد دون الحاجة لـ cd إليه.
- `HOME=...` يجعل Git يجد مفتاح SSH الخاص بـ Termux.
- `core.compression=0` يلغي الضغط فيسرّع الرفع ويخفف الضغط على الهاتف.

### قاعدة ذهبية

> قبل العمل على أي جهاز: `git pull`
> بعد الانتهاء: `git add .` ← `git commit` ← `git push`

---

## 5. معرفة حالة المشروع

| الأمر | وظيفته |
|---|---|
| `git status` | الملفات المعدلة والجديدة وما هو جاهز للـ commit |
| `git log --oneline` | سجل التعديلات مختصراً (سطر لكل commit) |
| `git log --oneline -10` | آخر 10 commits فقط |
| `git log --oneline --graph --all` | السجل على شكل شجرة بكل الفروع |
| `git diff` | تفاصيل ما تغير في الملفات (قبل add) |
| `git diff --staged` | تفاصيل ما تغير بعد add وقبل commit |
| `git show` | تفاصيل آخر commit |
| `git remote -v` | رابط GitHub المربوط |
| `git branch` | قائمة الفروع، والفرع الحالي عليه علامة * |

على الهاتف أضف قبل أي أمر: `git -C /storage/emulated/0/Projects`
مثال: `git -C /storage/emulated/0/Projects status`

---

## 6. التراجع عن الأخطاء

| الحالة | الأمر | ملاحظة |
|---|---|---|
| عدلت ملفاً ولم تعمل add وتريد التراجع عنه | `git restore اسم-الملف` | يعيده لآخر نسخة محفوظة |
| التراجع عن كل التعديلات غير المحفوظة | `git restore .` | خطر: التعديلات تضيع نهائياً |
| عملت add لملف وتريد إلغاءه | `git restore --staged اسم-الملف` | يبقى التعديل في الملف |
| غلطت في رسالة آخر commit (قبل push) | `git commit --amend -m "رسالة جديدة"` | لا تستخدمه بعد push |
| تراجع عن آخر commit مع إبقاء التعديلات | `git reset --soft HEAD~1` | آمن، تبقى الملفات كما هي |
| تراجع عن آخر commit وحذف تعديلاته | `git reset --hard HEAD~1` | خطر: يحذف التعديلات نهائياً |
| إلغاء commit قديم بأمان بعد push | `git revert <رقم-commit>` | ينشئ commit جديداً يعاكسه، دون تغيير السجل |
| حذف الملفات الجديدة غير المتعقبة | `git clean -fd` | خطر: حذف نهائي. جرّب أولاً `git clean -nd` لمعاينة ما سيُحذف |

للحصول على رقم commit استخدم `git log --oneline`.

---

## 7. الحفظ المؤقت (stash)

استخدمه عندما تريد عمل `git pull` وعندك تعديلات غير محفوظة.

```bash
git stash
```
حفظ التعديلات الحالية مؤقتاً وإعادة المجلد لحالة نظيفة.

```bash
git stash list
```
عرض قائمة التعديلات المخزنة.

```bash
git pull
git stash pop
```
جلب التحديثات ثم استرجاع تعديلاتك ودمجها.

```bash
git stash drop
```
حذف آخر stash دون استرجاعه.

---

## 8. المزامنة بين الهاتف والكمبيوتر

**إذا عدلت من الهاتف:**
1. ارفع تعديلات الهاتف (القسم 4).
2. على الكمبيوتر: `cd /d D:\Projects` ثم `git pull`.

**إذا عدلت من الكمبيوتر:**
1. ارفع تعديلات الكمبيوتر (القسم 4).
2. على الهاتف: `cd ~` ثم `git -C /storage/emulated/0/Projects pull`.

### إذا ظهر خطأ عند pull بسبب تعديلات محلية

```bash
git stash
git pull
git stash pop
```

### إذا ظهر تعارض (conflict)

يظهر في الملف هذا الشكل:
```
<<<<<<< HEAD
نسختك
=======
النسخة القادمة من GitHub
>>>>>>> 
```
عدّل الملف واترك النسخة المطلوبة وامسح علامات `<<<<<<<` و `=======` و `>>>>>>>`، ثم:
```bash
git add .
git commit -m "Resolve conflict"
git push
```

### إذا رُفض push (rejected / non-fast-forward)

معناه أن GitHub فيه تعديلات لا تملكها محلياً:
```bash
git pull
git push
```

---

## 9. الفروع (Branches)

| الأمر | وظيفته |
|---|---|
| `git branch` | عرض الفروع |
| `git branch اسم-فرع` | إنشاء فرع جديد |
| `git switch اسم-فرع` | الانتقال إلى فرع |
| `git switch -c اسم-فرع` | إنشاء فرع جديد والانتقال إليه مباشرة |
| `git merge اسم-فرع` | دمج الفرع المذكور في الفرع الحالي |
| `git branch -d اسم-فرع` | حذف فرع بعد دمجه |
| `git push -u origin اسم-فرع` | رفع فرع جديد إلى GitHub |
| `git fetch` | جلب معلومات التحديثات دون دمجها |

مثال لتجربة ميزة دون المساس بـ main:
```bash
git switch -c experiment
# ... تعدّل وتحفظ ...
git add . && git commit -m "Try new feature"
git switch main
git merge experiment
```

---

## 10. ملف .gitignore (تجاهل ملفات معينة)

أنشئ ملفاً باسم `.gitignore` داخل المشروع واكتب فيه ما لا تريد رفعه:

```
node_modules/
*.log
.env
.DS_Store
Thumbs.db
```

إذا كان الملف مرفوعاً سابقاً وتريد إيقاف تتبعه:
```bash
git rm --cached اسم-الملف
git commit -m "Stop tracking file"
```

---

## 11. إدارة الرابط (remote)

```bash
git remote -v
```
عرض الرابط الحالي.

```bash
git remote set-url origin git@github.com:Khalifa-fattah/اسم-المستودع.git
```
تغيير الرابط (مثلاً من HTTPS إلى SSH، أو بعد تغيير اسم المستودع).

---

## 12. اختصارات للهاتف (Termux)

افتح ملف الإعدادات:
```bash
nano ~/.bashrc
```

أضف في آخره:
```bash
alias gproj='cd /storage/emulated/0/Projects'
alias gstat='git -C /storage/emulated/0/Projects status'
alias gpull='git -C /storage/emulated/0/Projects pull'
alias glog='git -C /storage/emulated/0/Projects log --oneline -10'
alias gpush='git -C /storage/emulated/0/Projects add . && git -C /storage/emulated/0/Projects commit -m "Update from phone" && HOME=/data/data/com.termux/files/home git -C /storage/emulated/0/Projects -c core.compression=0 push'
```

احفظ بـ `Ctrl+O` ثم Enter ثم اخرج بـ `Ctrl+X`، وفعّلها:
```bash
source ~/.bashrc
```

بعدها تكفي كلمة واحدة: `gpull` أو `gstat` أو `gpush`.

---

## 13. أوامر مفيدة إضافية

| الأمر | وظيفته |
|---|---|
| `git add اسم-الملف` | تجهيز ملف واحد فقط بدل الكل |
| `git commit -am "..."` | add + commit للملفات المتتبعة فقط |
| `git rm اسم-الملف` | حذف ملف من المشروع ومن Git |
| `git mv القديم الجديد` | إعادة تسمية أو نقل ملف مع تتبعه |
| `git tag v1.0` ثم `git push origin v1.0` | وضع علامة إصدار ورفعها |
| `git config --global alias.st status` | إنشاء اختصار Git (`git st`) |
| `git shortlog -sn` | عدد commits لكل مساهم |

---

## ⚠️ تحذيرات مهمة

- لا تستخدم `git push --force` إلا إذا كنت تعرف بالضبط لماذا، فهو يمسح تعديلات من GitHub.
- الأوامر التالية تحذف عملك نهائياً، فكّر قبل تنفيذها:
  - `git restore .`
  - `git reset --hard`
  - `git clean -fd` (جرّب `-nd` أولاً للمعاينة)
- لا ترفع ملفات فيها كلمات مرور أو مفاتيح (`.env`) واستخدم `.gitignore`.
- إذا نسيت أي شيء: `git status` يخبرك دائماً بالوضع الحالي وما تفعله بعد ذلك.

---

## ملخص سريع (للحفظ)

| المهمة | الكمبيوتر | الهاتف |
|---|---|---|
| تنزيل لأول مرة | `git clone <رابط>` | `git clone <رابط>` |
| جلب التحديثات | `git pull` | `git -C /storage/emulated/0/Projects pull` |
| الحالة | `git status` | `git -C ... status` |
| تجهيز الكل | `git add .` | `git -C ... add .` |
| حفظ | `git commit -m "..."` | `git -C ... commit -m "..."` |
| رفع | `git push` | `HOME=... git -C ... -c core.compression=0 push` |
| السجل | `git log --oneline` | `git -C ... log --oneline` |
