import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { Upload, Image as ImageIcon, Sparkles, X } from 'lucide-react';
import { codeAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { toast } from 'sonner';

const UploadPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [framework, setFramework] = useState('react');
  const [loading, setLoading] = useState(false);
  const [imageId, setImageId] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  React.useEffect(() => {
    if (!user) {
      toast.error('Please login to upload');
      navigate('/login');
    }
  }, [user, navigate]);

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setSelectedFile(file);
      setPreview(URL.createObjectURL(file));

      const formData = new FormData();
      formData.append('file', file);

      setIsUploading(true);
      try {
        const response = await codeAPI.upload(formData);
        setImageId(response.data.image_id);
        setImageUrl(response.data.image_url || null);
        toast.success('Image uploaded successfully!');
      } catch (error) {
        toast.error(error.response?.data?.detail || 'Failed to upload image');
      } finally {
        setIsUploading(false);
      }
    }
  }, []);

  const onDropRejected = useCallback((fileRejections) => {
    fileRejections.forEach((rejection) => {
      rejection.errors.forEach((err) => {
        if (err.code === 'file-too-large') {
          toast.error('File exceeds the 10MB limit.');
        } else if (err.code === 'file-invalid-type') {
          toast.error('Only PNG and JPG files are allowed.');
        } else {
          toast.error(err.message);
        }
      });
    });
  }, []);

  const handleRemove = (e) => {
    e.stopPropagation();
    setSelectedFile(null);
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setPreview(null);
    setImageId(null);
    setIsUploading(false);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg']
    },
    maxSize: 10 * 1024 * 1024,
    multiple: false
  });




  const getDisabledReason = () => {
    if (loading) return "Generating code...";
    if (!selectedFile) return "Wait, upload an image first";
    if (isUploading) return "Wait for the image to finish uploading";
    if (!imageId) return "Image upload failed or missing";
    if (!framework) return "Select a framework";
    return null;
  };

  const disabledReason = getDisabledReason();
  const isGenerateDisabled = !!disabledReason;

  const handleGenerate = async () => {
    if (isGenerateDisabled) {
      toast.error(disabledReason);
      return;
    }

    setLoading(true);

    try {
      const response = await codeAPI.generate({
        image_id: imageId,
        framework: framework,
        image_url: imageUrl
      });

      navigate('/editor', {
        state: {
          code: response.data.code,
          framework: framework,
          image_url: imageUrl,
          isNew: true
        }
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold theme-text mb-4">Upload UI Screenshot</h1>
          <p className="text-lg theme-text-secondary">Upload your design and select a framework to generate code</p>
        </motion.div>

        <div className="space-y-8">
          {/* Upload Area */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${isDragActive
                ? 'border-purple-500 bg-purple-500/10'
                : preview
                  ? 'border-purple-500/40 bg-purple-500/5'
                  : 'theme-border hover:border-purple-500/40 theme-bg-card'
                }`}
              data-testid="upload-dropzone"
            >
              <input {...getInputProps()} data-testid="upload-input" />

              {preview ? (
                <div className="relative inline-block group/preview">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative"
                  >
                    <img
                      src={preview}
                      alt="Preview"
                      className="max-h-64 mx-auto rounded-xl border theme-border shadow-2xl"
                      data-testid="image-preview"
                    />
                    <button
                      onClick={handleRemove}
                      className="absolute -top-3 -right-3 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-all transform hover:scale-110 active:scale-95 group/btn"
                      title="Remove image"
                      data-testid="remove-image-btn"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                  <p className="mt-4 text-sm theme-text-secondary">Click or drag anywhere to replace</p>
                </div>
              ) : (
                <>
                  <Upload className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold theme-text mb-2">Drop your screenshot here</h3>
                  <p className="theme-text-secondary mb-4">or click to browse</p>
                  <p className="text-sm theme-text-tertiary">PNG or JPEG, max 10MB</p>
                </>
              )}
            </div>
          </motion.div>

          {/* Framework Selector */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="theme-bg-card border theme-border rounded-2xl p-7 theme-shadow theme-transition"
          >
            <h2 className="text-2xl font-bold text-center text-purple-500 mb-6">Select Output Technology</h2>
            <div className="space-y-8">
              {/* Complex UI Group */}
              <div>
                <h3 className="text-base font-semibold theme-text mb-1">Standard & Complex UI</h3>
                <p className="text-xs theme-text-secondary mb-4">Recommended for detailed layouts</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {[
                    { value: 'html_css', label: 'HTML / CSS' },
                    { value: 'vanilla_js', label: 'Vanilla JS' },
                    { value: 'bootstrap', label: 'Bootstrap' },
                    { value: 'tailwind', label: 'Tailwind CSS' },
                    { value: 'vue', label: 'Vue' },
                  ].map((fw) => (
                    <button
                      key={fw.value}
                      onClick={() => setFramework(fw.value)}
                      className={`py-3 px-4 rounded-xl border transition-all text-center text-sm font-medium ${framework === fw.value
                        ? 'bg-purple-500/15 border-purple-500 text-purple-400 shadow-lg shadow-purple-500/10'
                        : 'theme-bg-input theme-border theme-text-secondary hover:border-purple-500/40 hover:text-purple-400'
                      }`}
                    >
                      {fw.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Simple UI Group */}
              <div>
                <h3 className="text-base font-semibold theme-text mb-1">Simple Component UI</h3>
                <p className="text-xs theme-text-secondary mb-4">Best for individual components and basic layouts</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { value: 'react', label: 'React' },
                    { value: 'next_js', label: 'Next.js' },
                    { value: 'nuxt_js', label: 'Nuxt.js' },
                    { value: 'svelte', label: 'Svelte' },
                  ].map((fw) => (
                    <button
                      key={fw.value}
                      onClick={() => setFramework(fw.value)}
                      className={`py-3 px-4 rounded-xl border transition-all text-center text-sm font-medium ${framework === fw.value
                        ? 'bg-purple-500/15 border-purple-500 text-purple-400 shadow-lg shadow-purple-500/10'
                        : 'theme-bg-input theme-border theme-text-secondary hover:border-purple-500/40 hover:text-purple-400'
                      }`}
                    >
                      {fw.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Generate Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
          <button
            onClick={handleGenerate}
            className={`w-full py-4 bg-purple-600 hover:bg-purple-500 text-white text-lg font-medium rounded-xl transition-all hover:shadow-2xl hover:shadow-purple-500/40 flex items-center justify-center gap-2 ${isGenerateDisabled ? 'opacity-50 cursor-not-allowed hover:bg-purple-600' : ''}`}
            data-testid="generate-code-btn"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                Generating Code...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate Code
              </>
            )}
          </button>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
};

export default UploadPage;