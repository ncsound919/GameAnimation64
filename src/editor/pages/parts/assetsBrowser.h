/**
* @copyright 2025 - Max Bebök
* @license MIT
*/
#pragma once
#include "../../../renderer/texture.h"

namespace Editor
{
  class AssetsBrowser
  {
    private:
      Renderer::Texture iconFile;
      Renderer::Texture iconMesh;
      Renderer::Texture iconMusic;
      Renderer::Texture iconCodeAdd;
      Renderer::Texture iconCodeCpp;

      int activeTab{0};

    public:
      AssetsBrowser();
      ~AssetsBrowser();

      void draw();
  };
}