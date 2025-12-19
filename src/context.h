/**
* @copyright 2025 - Max Bebök
* @license MIT
*/
#pragma once
#include "project/project.h"
#include "SDL3/SDL.h"

namespace Renderer { class Scene; }

struct Context
{
  // Globals
  Project::Project *project{nullptr};
  Renderer::Scene *scene{nullptr};
  SDL_Window* window{nullptr};
  SDL_GPUDevice *gpu{nullptr};

  std::string clipboard{};

  // Editor state
  uint64_t selAssetUUID{0};
  uint32_t selObjectUUID{0};
  bool isBuildOrRunning{false};
};

extern Context ctx;