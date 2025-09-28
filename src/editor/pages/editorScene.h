/**
* @copyright 2025 - Max Bebök
* @license MIT
*/
#pragma once
#include "parts/assetsBrowser.h"
#include "parts/viewport3D.h"

namespace Editor
{
  class Scene
  {
    private:
      Viewport3D viewport3d{};
      AssetsBrowser assetsBrowser{};

      bool dockSpaceInit{false};

    public:
      void draw();
  };
}
