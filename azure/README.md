# הפריסה של Accountability Log Application בענן Azure

מסמך זה מספק הוראות מפורטות לפריסת האפליקציה בענן Azure באמצעות Docker Containers.

## דרישות מקדימות

לפני שמתחילים, יש צורך ב:
- מנוי Azure פעיל
- Azure CLI מותקן במחשב
- Docker Desktop מותקן ופועל
- Git

## שלבי הפריסה

### 1. הגדרת סביבת Azure

1. התקנת Azure CLI (אם לא מותקן):
   - הורדה מ: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli

2. התחברות ל-Azure:
   ```
   az login
   ```

3. ודאו שאתם משתמשים במנוי הנכון:
   ```
   az account show
   ```
   אם צריך להחליף מנוי:
   ```
   az account set --subscription "YOUR_SUBSCRIPTION_ID"
   ```

### 2. התאמת הגדרות הפריסה

1. ערוך את הקובץ `.env.azure` והתאם את הפרמטרים:
   - שנה את מזהה המנוי (`AZURE_SUBSCRIPTION_ID`)
   - שנה סיסמאות וערכים רגישים אחרים
   - התאם את האזור אם נדרש (`LOCATION`)

### 3. הרצת הפריסה

**לינוקס/macOS**:
1. הענק הרשאות הרצה לסקריפט:
   ```
   chmod +x azure-deploy.sh
   ```

2. הרצת הסקריפט:
   ```
   ./azure-deploy.sh
   ```

**Windows (PowerShell)**:
1. הרצת הסקריפט:
   ```
   .\deploy.ps1
   ```

### 4. בדיקת הפריסה

1. לאחר השלמת התהליך, האפליקציה תהיה זמינה בכתובות:
   - ממשק משתמש: `https://accountability-log-app.azurewebsites.net`
   - API: `https://accountability-log-app-api.azurewebsites.net`

2. ניתן לצפות בלוגים ומידע נוסף דרך פורטל Azure:
   - כניסה לפורטל: https://portal.azure.com
   - ניווט ל-App Services
   - בחירת האפליקציה הרלוונטית

## עדכון האפליקציה

כדי לעדכן את האפליקציה לאחר שינויים:

1. בנייה מחדש של הדוקר והעלאתו:
   ```
   az acr build --registry alaregistry --image ala-backend:latest ./backend
   az acr build --registry alaregistry --image ala-frontend:latest ./frontend
   ```

2. עדכון ה-Web App:
   ```
   az webapp restart --resource-group ala-resource-group --name accountability-log-app-api
   az webapp restart --resource-group ala-resource-group --name accountability-log-app
   ```

## פתרון בעיות

### בעיית התחברות ל-Azure Container Registry
```
az acr login --name alaregistry
```

### נתק בין אפליקציה לבסיס נתונים
1. בדוק את הגדרות חיבור ה-DATABASE_URL
2. ודא שכללי ה-Firewall מאפשרים גישה

### בעיות בהפעלת הדוקר
בדוק את הלוגים של האפליקציה:
```
az webapp log tail --resource-group ala-resource-group --name accountability-log-app-api
```

## גיבוי ושחזור

### גיבוי בסיס נתונים
```
az postgres flexible-server backup list --resource-group ala-resource-group --server-name ala-db
```

## סיכום

הסקריפטים שהוכנו מאפשרים פריסה מהירה ופשוטה של האפליקציה לענן Azure. ההגדרות הנוכחיות מתאימות לסביבת פיתוח וניתן להתאים אותן לסביבת ייצור לפי הצורך.
