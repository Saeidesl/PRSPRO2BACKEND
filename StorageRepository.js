const StorageRepository = {

  uploadBase64: function(data) {

    return GoogleDriveStorage.uploadBase64(
      data
    );

  },


  getFile: function(storageKey) {

    return GoogleDriveStorage.getFile(
      storageKey
    );

  },


  getFileAsBase64: function(storageKey) {

    return GoogleDriveStorage.getFileAsBase64(
      storageKey
    );

  },


  delete: function(storageKey) {

    return GoogleDriveStorage.delete(
      storageKey
    );

  }

};