const db = require('../database/db');
const s3Service = require('../services/s3Service');
const { v4: uuidv4 } = require('uuid');

async function filesRoutes(fastify, options) {
  // Require authentication for all routes
  fastify.addHook('preHandler', fastify.requireAuth);

  // Get files and folders in a directory
  fastify.get('/browse', async (request, reply) => {
    const { path = '' } = request.query;
    const userId = request.userId;

    try {
      // Get current folder
      let currentFolder = null;
      if (path) {
        const folderQuery = `
          SELECT * FROM folders 
          WHERE path = $1 AND user_id = $2
        `;
        const folderResult = await db.query(folderQuery, [path, userId]);
        currentFolder = folderResult.rows[0];
      }

      // Get subfolders
      const foldersQuery = `
        SELECT id, name, path, created_at 
        FROM folders 
        WHERE ${path ? 'parent_id = $2' : 'parent_id IS NULL'} 
        AND user_id = $1
        ORDER BY name
      `;
      const foldersParams = path ? [userId, currentFolder?.id] : [userId];
      const foldersResult = await db.query(foldersQuery, foldersParams);

      // Get files
      const filesQuery = `
        SELECT id, name, original_name, file_size, mime_type, created_at 
        FROM files 
        WHERE ${path ? 'folder_id = $2' : 'folder_id IS NULL'} 
        AND user_id = $1
        ORDER BY name
      `;
      const filesParams = path ? [userId, currentFolder?.id] : [userId];
      const filesResult = await db.query(filesQuery, filesParams);

      return {
        currentPath: path,
        folders: foldersResult.rows,
        files: filesResult.rows
      };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Failed to browse files' });
    }
  });
  // Create a new folder
  fastify.post('/folder', async (request, reply) => {
    const { name, path = '' } = request.body;
    const userId = request.userId;

    if (!name) {
      return reply.code(400).send({ error: 'Folder name is required' });
    }

    try {
      // Get parent folder if path exists
      let parentId = null;
      if (path) {
        const parentQuery = `
          SELECT id FROM folders 
          WHERE path = $1 AND user_id = $2
        `;
        const parentResult = await db.query(parentQuery, [path, userId]);
        if (parentResult.rows.length === 0) {
          return reply.code(404).send({ error: 'Parent folder not found' });
        }
        parentId = parentResult.rows[0].id;
      }

      const newPath = path ? `${path}/${name}` : name;

      const insertQuery = `
        INSERT INTO folders (name, parent_id, user_id, path)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      
      const result = await db.query(insertQuery, [name, parentId, userId, newPath]);
      
      return { folder: result.rows[0] };
    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
        return reply.code(409).send({ error: 'Folder already exists' });
      }
      fastify.log.error(error);
      reply.code(500).send({ error: 'Failed to create folder' });
    }
  });

  // Upload a file
  fastify.post('/upload', async (request, reply) => {
    try {
      const data = await request.file();      const { path = '' } = request.query;
      const userId = request.userId;

      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      // Input validation
      const maxFileSize = 100 * 1024 * 1024; // 100MB
      if (data.file.bytesRead > maxFileSize) {
        return reply.code(413).send({ error: 'File too large. Maximum size is 100MB' });
      }

      // Sanitize filename
      const sanitizedFilename = data.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      if (!sanitizedFilename) {
        return reply.code(400).send({ error: 'Invalid filename' });
      }

      // Validate MIME type (basic validation)
      const allowedTypes = [
        'image/', 'text/', 'application/pdf', 'application/msword',
        'application/vnd.openxmlformats', 'video/', 'audio/'
      ];
      const isAllowedType = allowedTypes.some(type => data.mimetype.startsWith(type));
      if (!isAllowedType) {
        return reply.code(400).send({ error: 'File type not allowed' });
      }

      // Get folder if path exists
      let folderId = null;
      if (path) {
        const folderQuery = `
          SELECT id FROM folders 
          WHERE path = $1 AND user_id = $2
        `;
        const folderResult = await db.query(folderQuery, [path, userId]);
        if (folderResult.rows.length === 0) {
          return reply.code(404).send({ error: 'Folder not found' });
        }
        folderId = folderResult.rows[0].id;
      }

      const buffer = await data.toBuffer();
      const fileExtension = sanitizedFilename.split('.').pop();
      const s3Key = `${userId}/${uuidv4()}.${fileExtension}`;

      // Upload to S3 first
      await s3Service.uploadFile(s3Key, buffer, data.mimetype);

      // Save to database
      const filePath = path ? `${path}/${sanitizedFilename}` : sanitizedFilename;
      const insertQuery = `
        INSERT INTO files (name, original_name, folder_id, user_id, s3_key, file_size, mime_type, path)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const result = await db.query(insertQuery, [
        sanitizedFilename,
        data.filename, // Keep original filename in database
        folderId,
        userId,
        s3Key,
        buffer.length,
        data.mimetype,
        filePath
      ]);

      return { file: result.rows[0] };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Failed to upload file' });
    }
  });
  // Download a file
  fastify.get('/file/:id/download', async (request, reply) => {
    const { id } = request.params;
    const userId = request.userId;

    try {
      const fileQuery = `
        SELECT * FROM files 
        WHERE id = $1 AND user_id = $2
      `;
      const result = await db.query(fileQuery, [id, userId]);

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'File not found' });
      }

      const file = result.rows[0];
      const fileStream = s3Service.getFileStream(file.s3_key);

      reply.type(file.mime_type);
      reply.header('Content-Disposition', `attachment; filename="${file.original_name}"`);
      
      return reply.send(fileStream);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Failed to download file' });
    }
  });
  // Delete a file
  fastify.delete('/file/:id', async (request, reply) => {
    const { id } = request.params;
    const userId = request.userId;

    try {
      const fileQuery = `
        SELECT * FROM files 
        WHERE id = $1 AND user_id = $2
      `;
      const result = await db.query(fileQuery, [id, userId]);

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'File not found' });
      }

      const file = result.rows[0];

      // Delete from S3
      await s3Service.deleteFile(file.s3_key);

      // Delete from database
      const deleteQuery = `DELETE FROM files WHERE id = $1`;
      await db.query(deleteQuery, [id]);

      return { success: true };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Failed to delete file' });
    }
  });
  // Rename a file
  fastify.put('/file/:id/rename', async (request, reply) => {
    const { id } = request.params;
    const { name } = request.body;
    const userId = request.userId;

    if (!name) {
      return reply.code(400).send({ error: 'File name is required' });
    }

    try {
      const fileQuery = `
        SELECT * FROM files 
        WHERE id = $1 AND user_id = $2
      `;
      const result = await db.query(fileQuery, [id, userId]);

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'File not found' });
      }

      const file = result.rows[0];
      
      // Update path
      const pathParts = file.path.split('/');
      pathParts[pathParts.length - 1] = name;
      const newPath = pathParts.join('/');

      // Update file
      const updateQuery = `
        UPDATE files 
        SET name = $1, original_name = $1, path = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `;
      
      const updateResult = await db.query(updateQuery, [name, newPath, id]);

      return { file: updateResult.rows[0] };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Failed to rename file' });
    }
  });
}

module.exports = filesRoutes;
