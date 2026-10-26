/** Must be imported before any module that touches firebase-admin: it only needs a project id and a bucket name. */
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: 'demo-ui', storageBucket: 'demo-ui.appspot.com' });
process.env.GCLOUD_PROJECT = 'demo-ui';
process.env.LW_MOCK = '1';
