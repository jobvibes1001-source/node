const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const CREDENTIALS_PATH =
  process.env.GOOGLE_DRIVE_CREDENTIALS_FILE ||
  path.resolve(__dirname, "jobvibes-d2cac-f63636e29c35.json");
const ROOT_FOLDER_NAME =
  process.env.GOOGLE_DRIVE_ROOT_FOLDER_NAME || "JobVibes-metadata";
const PARENT_FOLDER_ID = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || "";
const ENABLE_PUBLIC_READ =
  (process.env.GOOGLE_DRIVE_PUBLIC_READ || "true").toLowerCase() === "true";

let driveClientPromise;
let rootFolderIdPromise;

const assertCredentialsFile = () => {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      `Google Drive credentials file not found at: ${CREDENTIALS_PATH}`
    );
  }

  const raw = fs.readFileSync(CREDENTIALS_PATH, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error(
      "Invalid Google Drive credentials JSON: client_email/private_key missing"
    );
  }
};

const sanitizeFolderName = (value) =>
  String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "-")
    .slice(0, 100);

const getDriveClient = async () => {
  if (!driveClientPromise) {
    assertCredentialsFile();
    const auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });

    driveClientPromise = Promise.resolve(
      google.drive({
        version: "v3",
        auth,
      })
    );
  }

  return driveClientPromise;
};

const findFolderByName = async ({ drive, name, parentId = "" }) => {
  const queryParts = [
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
    `name='${name.replace(/'/g, "\\'")}'`,
  ];

  if (parentId) {
    queryParts.push(`'${parentId}' in parents`);
  }

  const res = await drive.files.list({
    q: queryParts.join(" and "),
    fields: "files(id,name)",
    pageSize: 1,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });

  return res.data.files?.[0] || null;
};

const createFolder = async ({ drive, name, parentId = "" }) => {
  const response = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    },
    fields: "id,name",
    supportsAllDrives: true,
  });

  return response.data;
};

const ensureFolder = async ({ drive, name, parentId = "" }) => {
  const safeName = sanitizeFolderName(name);
  const existing = await findFolderByName({ drive, name: safeName, parentId });
  if (existing) return existing.id;
  const created = await createFolder({ drive, name: safeName, parentId });
  return created.id;
};

const ensureRootFolder = async () => {
  if (!rootFolderIdPromise) {
    rootFolderIdPromise = (async () => {
      const drive = await getDriveClient();
      return ensureFolder({
        drive,
        name: ROOT_FOLDER_NAME,
        parentId: PARENT_FOLDER_ID,
      });
    })();
  }
  return rootFolderIdPromise;
};

const ensureUserCategoryFolder = async ({ userId, category = "general" }) => {
  const drive = await getDriveClient();
  const rootFolderId = await ensureRootFolder();
  const usersFolderId = await ensureFolder({
    drive,
    name: "users",
    parentId: rootFolderId,
  });
  const userFolderId = await ensureFolder({
    drive,
    name: sanitizeFolderName(userId || "unknown-user"),
    parentId: usersFolderId,
  });
  const categoryFolderId = await ensureFolder({
    drive,
    name: sanitizeFolderName(category),
    parentId: userFolderId,
  });

  return { rootFolderId, usersFolderId, userFolderId, categoryFolderId };
};

const uploadFileToGoogleDrive = async ({
  localFilePath,
  originalName,
  mimeType,
  userId,
  category,
  metadata = {},
}) => {
  const drive = await getDriveClient();
  const { categoryFolderId, userFolderId } = await ensureUserCategoryFolder({
    userId,
    category,
  });

  const fileStream = fs.createReadStream(localFilePath);
  const requestBody = {
    name: sanitizeFolderName(originalName || path.basename(localFilePath)),
    parents: [categoryFolderId],
    description: JSON.stringify({
      userId,
      category,
      ...metadata,
      uploadedAt: new Date().toISOString(),
    }),
  };

  const createdFile = await drive.files.create({
    requestBody,
    media: {
      mimeType: mimeType || "application/octet-stream",
      body: fileStream,
    },
    fields: "id,name,mimeType,size,webViewLink,webContentLink,parents",
    supportsAllDrives: true,
  });

  if (ENABLE_PUBLIC_READ) {
    try {
      await drive.permissions.create({
        fileId: createdFile.data.id,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
        supportsAllDrives: true,
      });
    } catch (error) {
      console.warn(
        `Unable to set public read on Drive file ${createdFile.data.id}:`,
        error.message
      );
    }
  }

  const previewUrl =
    createdFile.data.webViewLink ||
    `https://drive.google.com/file/d/${createdFile.data.id}/view`;
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${createdFile.data.id}`;
  const openUrl = `https://drive.google.com/uc?id=${createdFile.data.id}`;

  return {
    fileId: createdFile.data.id,
    fileName: createdFile.data.name,
    mimeType: createdFile.data.mimeType,
    size: Number(createdFile.data.size || 0),
    // Keep `url` as direct file URL for PDF/video/doc consumers.
    url: downloadUrl,
    webViewLink: previewUrl,
    webContentLink: createdFile.data.webContentLink || openUrl,
    downloadUrl,
    openUrl,
    driveFolderId: userFolderId,
    driveCategoryFolderId: categoryFolderId,
  };
};

const deleteFileFromGoogleDrive = async (fileId) => {
  if (!fileId) return;
  const drive = await getDriveClient();
  await drive.files.delete({
    fileId,
    supportsAllDrives: true,
  });
};

module.exports = {
  uploadFileToGoogleDrive,
  deleteFileFromGoogleDrive,
  ensureRootFolder,
  ensureUserCategoryFolder,
};
